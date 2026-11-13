package com.smartparcel.controller;

import com.smartparcel.dto.*;
import com.smartparcel.model.*;
import com.smartparcel.repository.*;
import com.smartparcel.service.AgentTrustService;
import com.smartparcel.service.OperationsAnalyticsService;
import com.smartparcel.service.ResidentPreferencesService;
import com.smartparcel.service.RouteBatchingService;
import jakarta.validation.Valid;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/parcels")
public class ParcelController {
    private static final int ISSUE_WINDOW_DAYS = 7;

    private final ParcelRepository repository;
    private final UserRepository userRepository;
    private final NotificationRepository notificationRepository;
    private final ParcelMessageRepository messageRepository;
    private final RouteBatchingService routeBatchingService;
    private final ResidentPreferencesService residentPreferencesService;
    private final AgentTrustService agentTrustService;
    private final OperationsAnalyticsService operationsAnalyticsService;
    private final SecureRandom random = new SecureRandom();

    public ParcelController(ParcelRepository repository,
                            UserRepository userRepository,
                            NotificationRepository notificationRepository,
                            ParcelMessageRepository messageRepository,
                            RouteBatchingService routeBatchingService,
                            ResidentPreferencesService residentPreferencesService,
                            AgentTrustService agentTrustService,
                            OperationsAnalyticsService operationsAnalyticsService) {
        this.repository = repository;
        this.userRepository = userRepository;
        this.notificationRepository = notificationRepository;
        this.messageRepository = messageRepository;
        this.routeBatchingService = routeBatchingService;
        this.residentPreferencesService = residentPreferencesService;
        this.agentTrustService = agentTrustService;
        this.operationsAnalyticsService = operationsAnalyticsService;
    }

    @GetMapping
    public List<Parcel> list(
            @RequestParam(defaultValue = "ADMIN") String role,
            @RequestParam(required = false) String flatNumber,
            @RequestParam(defaultValue = "recent") String sort) {
        if ("RESIDENT".equalsIgnoreCase(role)) {
            if (flatNumber == null || flatNumber.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "flatNumber is required");
            }
            String flat = flatNumber.trim().toUpperCase();
            return repository.findByFlatNumberOrDelegateFlatOrderByReceivedAtDesc(flat, flat);
        }
        if (!"ADMIN".equalsIgnoreCase(role)
                && !"DELIVERY_AGENT".equalsIgnoreCase(role)
                && !"AGENT".equalsIgnoreCase(role)
                && !"SECURITY".equalsIgnoreCase(role)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown role: " + role);
        }
        List<Parcel> all = repository.findAllByOrderByReceivedAtDesc();
        if ("route".equalsIgnoreCase(sort)) {
            return routeBatchingService.sortParcelsForAgentRoute(all);
        }
        return all;
    }

    @GetMapping("/route-queue")
    public Map<String, Object> routeQueue(
            @RequestParam(defaultValue = "DELIVERY_AGENT") String role,
            @RequestParam(required = false) String flatNumber) {
        String residentFlat = null;
        if ("RESIDENT".equalsIgnoreCase(role)) {
            if (flatNumber == null || flatNumber.isBlank()) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "flatNumber is required");
            }
            residentFlat = flatNumber.trim().toUpperCase();
        }
        return routeBatchingService.buildRouteQueuePayload(repository.findAll(), residentFlat);
    }

    @GetMapping("/agent-trust")
    public Map<String, Object> agentTrust() {
        return agentTrustService.buildAgentTrustSummary(
            repository.findAll(),
            userRepository.findByRole(UserRole.ROLE_DELIVERY_AGENT)
        );
    }

    @GetMapping("/{id}")
    public Parcel getById(@PathVariable Long id) {
        return get(id);
    }

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        return operationsAnalyticsService.buildStatsPayload(
            repository.findAll(),
            userRepository.findByRole(UserRole.ROLE_DELIVERY_AGENT),
            LocalDateTime.now()
        );
    }

    @PostMapping("/{id}/escalate-sla")
    public Map<String, Object> escalateSla(@PathVariable Long id, @RequestParam(required = false) String actorName) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel is already delivered.");
        }
        LocalDateTime now = LocalDateTime.now();
        p.setSlaEscalated(true);
        p.setSlaEscalatedAt(now);
        Parcel saved = repository.save(p);

        Map<String, Object> sla = operationsAnalyticsService.computeParcelSla(saved, now);
        String actor = hasText(actorName) ? actorName.trim() : "Operations SLA Monitor";
        String elapsedLabel = String.valueOf(sla.get("formattedElapsed"));

        messageRepository.save(new ParcelMessage(
            saved.getId(),
            null,
            actor,
            UserRole.ROLE_ADMIN,
            "[SLA Escalation · Pending " + elapsedLabel + "] Priority handover attention requested for Flat " + saved.getFlatNumber() + "."
        ));

        notifyDeliveryAgents(
            saved,
            "SLA Escalation · Flat " + saved.getFlatNumber(),
            saved.getCourier() + " parcel " + saved.getTrackingNumber() + " has been waiting " + elapsedLabel
                + ". Prioritize immediate doorstep handover.",
            NotificationType.SLA_ESCALATION
        );

        notifyAdmins(
            saved,
            "SLA Escalated · " + saved.getTrackingNumber(),
            "Parcel " + saved.getTrackingNumber() + " for Flat " + saved.getFlatNumber()
                + " escalated (" + sla.get("label") + ").",
            NotificationType.SLA_ESCALATION
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("message", "SLA escalation alert sent to Delivery Agent & Operations Admin");
        res.put("parcel", saved);
        res.put("sla", sla);
        return res;
    }

    @PostMapping("/escalate-overdue")
    public Map<String, Object> escalateAllOverdue(@RequestParam(required = false) String actorName) {
        LocalDateTime now = LocalDateTime.now();
        List<Parcel> all = repository.findAll();
        List<Long> escalatedIds = new ArrayList<>();
        String actor = hasText(actorName) ? actorName.trim() : "Operations SLA Monitor";

        for (Parcel p : all) {
            if (p.getStatus() == ParcelStatus.HANDED_OVER || p.getStatus() == ParcelStatus.RESCHEDULED) {
                continue;
            }
            Map<String, Object> sla = operationsAnalyticsService.computeParcelSla(p, now);
            boolean overdue = Boolean.TRUE.equals(sla.get("isOverdue"));
            if (overdue && !p.isSlaEscalated()) {
                p.setSlaEscalated(true);
                p.setSlaEscalatedAt(now);
                Parcel saved = repository.save(p);
                escalatedIds.add(saved.getId());

                String elapsedLabel = String.valueOf(sla.get("formattedElapsed"));
                messageRepository.save(new ParcelMessage(
                    saved.getId(),
                    null,
                    actor,
                    UserRole.ROLE_ADMIN,
                    "[Auto SLA Breach > 4h · " + elapsedLabel + "] Flagged overdue delivery for Flat " + saved.getFlatNumber() + "."
                ));
                notifyDeliveryAgents(
                    saved,
                    "Overdue > 4h SLA Alert · Flat " + saved.getFlatNumber(),
                    saved.getCourier() + " parcel " + saved.getTrackingNumber() + " breached 4h SLA (" + elapsedLabel + ").",
                    NotificationType.SLA_ESCALATION
                );
            }
        }

        return Map.of(
            "message", escalatedIds.isEmpty()
                ? "All overdue parcels are already escalated."
                : "Escalated " + escalatedIds.size() + " overdue parcel(s) (> 4h SLA).",
            "escalatedCount", escalatedIds.size(),
            "escalatedParcelIds", escalatedIds
        );
    }

    @PostMapping
    public Parcel create(@Valid @RequestBody CreateParcelRequest req) {
        if (repository.existsByTrackingNumber(req.trackingNumber().trim())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tracking number already exists");
        }

        User fallbackAgent = resolveDefaultAgent();
        Long agentId = req.agentId() != null ? req.agentId() : (fallbackAgent != null ? fallbackAgent.getId() : null);
        String agentName = hasText(req.agentName()) ? req.agentName().trim()
            : (fallbackAgent != null ? fallbackAgent.getName() : "Delivery Partner");
        String agentPhone = hasText(req.agentPhone()) ? req.agentPhone().trim()
            : (fallbackAgent != null ? fallbackAgent.getPhone() : null);

        Parcel p = new Parcel();
        p.setTrackingNumber(req.trackingNumber().trim());
        p.setCourier(req.courier().trim());
        p.setFlatNumber(req.flatNumber().trim().toUpperCase());
        p.setRecipientName(req.recipientName());
        p.setRecipientPhone(req.recipientPhone());
        p.setCategory(hasText(req.category()) ? req.category().trim() : "Box");
        p.setDescription(req.description());
        p.setAgentId(agentId);
        p.setAgentName(agentName);
        p.setAgentPhone(agentPhone);

        // Apply saved Resident Default Doorstep Rules & Vacation Mode Auto-Hold
        LocalDate today = LocalDate.now();
        Optional<User> prefOwnerOpt = residentPreferencesService.resolveFlatPreferenceOwner(
            userRepository.findByFlatNumber(p.getFlatNumber()),
            today
        );
        boolean vacationApplied = false;
        if (prefOwnerOpt.isPresent()) {
            User prefOwner = prefOwnerOpt.get();
            if (!hasText(p.getRecipientName()) && hasText(prefOwner.getName())) {
                p.setRecipientName(prefOwner.getName());
            }
            String effectiveRule = residentPreferencesService.buildEffectiveDefaultInstruction(prefOwner);
            if (hasText(effectiveRule)) {
                p.setDeliveryInstruction(effectiveRule);
            }
            if (residentPreferencesService.isVacationActiveOn(prefOwner, today)) {
                LocalDate resumeDate = residentPreferencesService.computePostVacationDeliveryDate(prefOwner, today);
                p.setStatus(ParcelStatus.RESCHEDULED);
                p.setPreferredDate(resumeDate.toString());
                p.setSlot(hasText(prefOwner.getDefaultSlot()) ? prefOwner.getDefaultSlot().trim() : "7:00 PM – 9:00 PM");
                p.setRescheduleReason(
                    "Vacation Mode active"
                        + (hasText(prefOwner.getVacationUntil()) ? " until " + prefOwner.getVacationUntil() : "")
                        + " — auto-scheduled next attempt"
                );
                p.setRescheduledOnce(true);
                vacationApplied = true;
            } else if (hasText(prefOwner.getDefaultSlot())) {
                p.setPreferredDate(today.toString());
                p.setSlot(prefOwner.getDefaultSlot().trim());
                p.setStatus(ParcelStatus.SLOT_BOOKED);
            }
        }

        Parcel saved;
        try {
            saved = repository.save(p);
        } catch (DataIntegrityViolationException ex) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Tracking number already exists");
        }

        if (vacationApplied) {
            messageRepository.save(new ParcelMessage(
                saved.getId(),
                null,
                "SmartParcel Vacation Mode",
                UserRole.ROLE_RESIDENT,
                "Vacation Mode is active for Flat " + saved.getFlatNumber() + ". Parcel " + saved.getTrackingNumber()
                    + " has been auto-held and scheduled for " + saved.getPreferredDate() + " (" + saved.getSlot() + ")."
            ));

            notifyFlatResidents(
                saved,
                "Vacation Auto-Hold · " + saved.getTrackingNumber(),
                "Your Vacation Mode rule auto-held " + saved.getCourier() + " parcel " + saved.getTrackingNumber()
                    + " until " + saved.getPreferredDate() + " (" + saved.getSlot() + ").",
                NotificationType.VACATION_AUTO_HOLD
            );

            notifyDeliveryAgents(
                saved,
                "Vacation Mode Auto-Hold · Flat " + saved.getFlatNumber(),
                "Resident has Vacation Mode active. " + saved.getCourier() + " (" + saved.getTrackingNumber()
                    + ") was automatically flagged for reschedule on " + saved.getPreferredDate() + ".",
                NotificationType.VACATION_AUTO_HOLD
            );
        } else {
            String ruleSuffix = hasText(saved.getDeliveryInstruction())
                ? " Applied saved rule: \"" + saved.getDeliveryInstruction() + "\"."
                : "";

            messageRepository.save(new ParcelMessage(
                saved.getId(),
                agentId,
                agentName,
                UserRole.ROLE_DELIVERY_AGENT,
                "Hi! I am your " + saved.getCourier() + " delivery agent with parcel " + saved.getTrackingNumber()
                    + " for Flat " + saved.getFlatNumber() + ". Reply here or choose your delivery instruction." + ruleSuffix
            ));

            notifyFlatResidents(
                saved,
                "Delivery Arriving (" + saved.getCourier() + ")",
                agentName + " logged parcel #" + saved.getTrackingNumber() + " (" + saved.getCategory()
                    + ") for Flat " + saved.getFlatNumber() + "." + ruleSuffix,
                NotificationType.PARCEL_ARRIVED
            );
        }

        return saved;
    }

    @PatchMapping("/{id}/slot")
    public Parcel bookSlot(@PathVariable Long id, @Valid @RequestBody SlotRequest req) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel already handed over");
        }
        if (p.isRescheduledOnce()) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "This parcel has already been rescheduled once. Delivery schedule is locked."
            );
        }
        String day = hasText(req.preferredDate()) ? req.preferredDate().trim() : LocalDate.now().toString();
        p.setSlot(req.slot());
        p.setPreferredDate(day);
        p.setRescheduleReason(null);
        p.setStatus(ParcelStatus.SLOT_BOOKED);
        resetAgentScheduleConfirmation(p);
        Parcel saved = repository.save(p);

        notifyFlatResidents(
            saved,
            "Delivery Window Confirmed",
            "Your delivery window for parcel " + saved.getTrackingNumber() + " is confirmed for Today (" + req.slot() + ").",
            NotificationType.SLOT_CONFIRMED
        );

        notifyDeliveryAgents(
            saved,
            "Slot Selected · Flat " + saved.getFlatNumber(),
            "Resident requested delivery during " + req.slot() + " for " + saved.getCourier() + " (" + saved.getTrackingNumber() + ").",
            NotificationType.SLOT_CONFIRMED
        );

        return saved;
    }

    @PatchMapping("/{id}/reschedule")
    public Parcel rescheduleParcel(@PathVariable Long id, @Valid @RequestBody RescheduleRequest req) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel already handed over");
        }
        if (p.isRescheduledOnce()) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "This parcel has already been rescheduled once. Only one reschedule is allowed per delivery."
            );
        }
        String preferredDate = req.preferredDate().trim();
        String slot = req.slot().trim();
        String reason = hasText(req.reason()) ? req.reason().trim() : null;

        p.setPreferredDate(preferredDate);
        p.setSlot(slot);
        p.setRescheduleReason(reason);
        p.setRescheduledOnce(true);
        p.setStatus(ParcelStatus.RESCHEDULED);
        resetAgentScheduleConfirmation(p);
        Parcel saved = repository.save(p);

        String reasonNote = reason != null ? " Reason: " + reason : "";
        notifyFlatResidents(
            saved,
            "Delivery Rescheduled",
            "Parcel " + saved.getTrackingNumber() + " is rescheduled for " + preferredDate + " (" + slot + ").",
            NotificationType.PARCEL_RESCHEDULED
        );

        notifyDeliveryAgents(
            saved,
            "Rescheduled · Flat " + saved.getFlatNumber(),
            "Resident is unavailable today for " + saved.getCourier() + " (" + saved.getTrackingNumber()
                + "). Next attempt: " + preferredDate + " · " + slot + "." + reasonNote,
            NotificationType.PARCEL_RESCHEDULED
        );

        return saved;
    }

    @PostMapping("/{id}/confirm-schedule")
    public Map<String, Object> confirmSchedule(
        @PathVariable Long id,
        @RequestBody(required = false) ConfirmScheduleRequest req
    ) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel already handed over");
        }
        if (p.getStatus() != ParcelStatus.SLOT_BOOKED && p.getStatus() != ParcelStatus.RESCHEDULED) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Resident has not chosen a delivery slot or reschedule yet."
            );
        }

        String who = (req != null && hasText(req.agentName()))
            ? req.agentName().trim()
            : (hasText(p.getAgentName()) ? p.getAgentName() : "Delivery Partner");
        String slotText = hasText(p.getSlot()) ? p.getSlot() : "scheduled window";
        String dateText = hasText(p.getPreferredDate()) ? p.getPreferredDate() : LocalDate.now().toString();

        String confirmMsg = (req != null && hasText(req.message()))
            ? req.message().trim()
            : (p.getStatus() == ParcelStatus.RESCHEDULED
                ? "Confirmed by " + who + ": Your rescheduled delivery for " + dateText + " (" + slotText + ") is locked in."
                : "Confirmed by " + who + ": Your delivery slot (" + slotText + ", " + dateText + ") is confirmed.");

        p.setAgentScheduleConfirmed(true);
        p.setAgentScheduleConfirmedAt(LocalDateTime.now());
        p.setAgentScheduleConfirmedBy(who);
        p.setAgentScheduleConfirmMessage(confirmMsg);
        Parcel saved = repository.save(p);

        notifyFlatResidents(
            saved,
            (saved.getStatus() == ParcelStatus.RESCHEDULED ? "Reschedule Confirmed · " : "Slot Confirmed · ") + saved.getTrackingNumber(),
            confirmMsg,
            NotificationType.AGENT_SCHEDULE_CONFIRMED
        );

        messageRepository.save(new ParcelMessage(
            saved.getId(),
            saved.getAgentId(),
            who,
            UserRole.ROLE_DELIVERY_AGENT,
            "[Schedule Confirmed] " + confirmMsg
        ));

        return Map.of(
            "message", "Schedule confirmation sent to resident.",
            "parcel", saved
        );
    }

    private void resetAgentScheduleConfirmation(Parcel p) {
        p.setAgentScheduleConfirmed(false);
        p.setAgentScheduleConfirmedAt(null);
        p.setAgentScheduleConfirmedBy(null);
        p.setAgentScheduleConfirmMessage(null);
    }

    @PatchMapping("/{id}/instruction")
    public Parcel updateInstruction(@PathVariable Long id, @Valid @RequestBody InstructionRequest req) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel already handed over");
        }
        String instruction = req.instruction().trim();
        p.setDeliveryInstruction(instruction);
        Parcel saved = repository.save(p);

        String who = hasText(req.residentName()) ? req.residentName().trim() : "Resident";
        notifyDeliveryAgents(
            saved,
            "Delivery Instruction · Flat " + saved.getFlatNumber(),
            who + " set preference for " + saved.getTrackingNumber() + ": \"" + instruction + "\"",
            NotificationType.DELIVERY_INSTRUCTION
        );

        return saved;
    }

    @GetMapping("/messages-summary")
    public Map<Long, Map<String, Object>> getMessagesSummary() {
        List<ParcelMessage> all = messageRepository.findAllByOrderByCreatedAtAsc();
        Map<Long, List<ParcelMessage>> grouped = all.stream()
            .collect(Collectors.groupingBy(ParcelMessage::getParcelId));

        Map<Long, Map<String, Object>> summary = new HashMap<>();
        for (Map.Entry<Long, List<ParcelMessage>> entry : grouped.entrySet()) {
            List<ParcelMessage> msgs = entry.getValue();
            ParcelMessage last = msgs.get(msgs.size() - 1);
            Map<String, Object> item = new HashMap<>();
            item.put("count", msgs.size());
            item.put("lastMessage", last.getMessage());
            item.put("lastSenderName", last.getSenderName());
            item.put("lastSenderRole", last.getSenderRole());
            item.put("lastAt", last.getCreatedAt() != null ? last.getCreatedAt().toString() : "");
            summary.put(entry.getKey(), item);
        }
        return summary;
    }

    @GetMapping("/{id}/messages")
    public List<ParcelMessage> getMessages(@PathVariable Long id) {
        get(id);
        return messageRepository.findByParcelIdOrderByCreatedAtAsc(id);
    }

    @PostMapping("/{id}/messages")
    public ParcelMessage sendMessage(@PathVariable Long id, @Valid @RequestBody SendMessageRequest req) {
        Parcel p = get(id);
        UserRole senderRole = req.senderRole() != null ? req.senderRole() : UserRole.ROLE_RESIDENT;
        String senderName = req.senderName().trim();
        String msgText = req.message().trim();

        ParcelMessage saved = messageRepository.save(
            new ParcelMessage(id, req.senderId(), senderName, senderRole, msgText)
        );

        if (senderRole == UserRole.ROLE_DELIVERY_AGENT) {
            notifyFlatResidents(
                p,
                "Message from Delivery Agent (" + p.getCourier() + ")",
                senderName + ": \"" + msgText + "\" [Parcel " + p.getTrackingNumber() + "]",
                NotificationType.NEW_MESSAGE
            );
        } else if (senderRole == UserRole.ROLE_RESIDENT) {
            notifyDeliveryAgents(
                p,
                "Message from Resident · Flat " + p.getFlatNumber(),
                senderName + ": \"" + msgText + "\" [Parcel " + p.getTrackingNumber() + "]",
                NotificationType.NEW_MESSAGE
            );
        } else {
            notifyFlatResidents(p, "Support Note (" + p.getCourier() + ")", senderName + ": " + msgText, NotificationType.NEW_MESSAGE);
            notifyDeliveryAgents(p, "Support Note · Flat " + p.getFlatNumber(), senderName + ": " + msgText, NotificationType.NEW_MESSAGE);
        }

        return saved;
    }

    @PostMapping("/{id}/generate-otp")
    public Map<String, String> generateOtp(@PathVariable Long id) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel already handed over");
        }
        String otp = String.format("%06d", random.nextInt(1_000_000));
        p.setDemoOtp(otp);
        repository.save(p);

        notifyFlatResidents(
            p,
            "Handover OTP Ready: " + otp,
            "Your delivery agent is ready to hand over your " + p.getCourier() + " package (" + p.getTrackingNumber()
                + "). Share this 6-digit OTP directly with the delivery agent upon receiving your parcel: " + otp,
            NotificationType.OTP_DISPATCHED
        );

        return Map.of(
            "demoOtp", otp,
            "warning", "OTP has been privately dispatched to resident notification inbox.",
            "flatNumber", p.getFlatNumber()
        );
    }

    @PostMapping("/{id}/delegate")
    public Parcel authorizeDelegate(@PathVariable Long id, @Valid @RequestBody DelegateRequest req) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel already handed over");
        }
        String delegateFlat = req.delegateFlat().trim().toUpperCase();
        String delegateName = req.delegateName().trim();
        String delegateOtp = String.format("%06d", random.nextInt(1_000_000));

        p.setDelegated(true);
        p.setDelegateFlat(delegateFlat);
        p.setDelegateName(delegateName);
        p.setDelegatePhone(hasText(req.delegatePhone()) ? req.delegatePhone().trim() : null);
        p.setDelegateOtp(delegateOtp);
        Parcel saved = repository.save(p);

        String noteSuffix = hasText(req.note()) ? " Note: " + req.note().trim() : "";
        messageRepository.save(new ParcelMessage(
            saved.getId(),
            null,
            "SmartParcel Delegate Pass",
            UserRole.ROLE_RESIDENT,
            "Authorized " + delegateName + " (Flat " + delegateFlat + ") to collect "
                + saved.getTrackingNumber() + " with a Delegate OTP." + noteSuffix
        ));

        notifyDeliveryAgents(
            saved,
            "Delegate Authorized · Flat " + saved.getFlatNumber() + " → " + delegateFlat,
            saved.getCourier() + " parcel " + saved.getTrackingNumber()
                + " can be handed over to " + delegateName + " at Flat " + delegateFlat + "." + noteSuffix,
            NotificationType.DELEGATE_AUTHORIZED
        );

        if (!delegateFlat.equalsIgnoreCase(saved.getFlatNumber())) {
            notifyUsersInFlat(
                delegateFlat,
                saved.getId(),
                "Neighbor Pickup Pass · Delegate OTP: " + delegateOtp,
                "Resident at Flat " + saved.getFlatNumber() + " authorized Flat " + delegateFlat
                    + " (" + delegateName + ") to collect parcel " + saved.getTrackingNumber()
                    + ". Share Delegate OTP " + delegateOtp + " or Digital Pass QR at handover.",
                NotificationType.DELEGATE_AUTHORIZED
            );
        }

        notifyFlatResidents(
            saved,
            "Delegate Pass Active · Flat " + delegateFlat,
            "Authorized " + delegateName + " (Flat " + delegateFlat + ") for parcel "
                + saved.getTrackingNumber() + ". Delegate OTP: " + delegateOtp + ".",
            NotificationType.DELEGATE_AUTHORIZED
        );

        return saved;
    }

    @DeleteMapping("/{id}/delegate")
    public Parcel revokeDelegate(@PathVariable Long id) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel already handed over");
        }
        String prevFlat = p.getDelegateFlat();
        p.setDelegated(false);
        p.setDelegateFlat(null);
        p.setDelegateName(null);
        p.setDelegatePhone(null);
        p.setDelegateOtp(null);
        Parcel saved = repository.save(p);

        notifyDeliveryAgents(
            saved,
            "Delegate Pass Revoked · Flat " + saved.getFlatNumber(),
            "Delegate authorization for parcel " + saved.getTrackingNumber() + " has been cancelled by the resident.",
            NotificationType.SYSTEM
        );
        if (hasText(prevFlat) && !prevFlat.equalsIgnoreCase(saved.getFlatNumber())) {
            notifyUsersInFlat(
                prevFlat,
                saved.getId(),
                "Neighbor Pickup Cancelled",
                "Delegate pass for Flat " + saved.getFlatNumber() + " parcel " + saved.getTrackingNumber() + " was revoked.",
                NotificationType.SYSTEM
            );
        }
        return saved;
    }

    @PostMapping("/{id}/handover")
    public Map<String, Object> handover(@PathVariable Long id, @Valid @RequestBody HandoverRequest req) {
        Parcel p = get(id);
        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Parcel already handed over");
        }
        String code = req.otp().trim();
        boolean matchesResidentOtp = hasText(p.getDemoOtp()) && p.getDemoOtp().equals(code);
        boolean matchesDelegateOtp = p.isDelegated() && hasText(p.getDelegateOtp()) && p.getDelegateOtp().equals(code);
        if (!matchesResidentOtp && !matchesDelegateOtp) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid OTP. Please verify the 6-digit code with the resident.");
        }

        boolean safeDropRequired = isSafeDropRequired(p);
        if (safeDropRequired && !hasText(req.proofPhotoUrl())) {
            throw new ResponseStatusException(
                HttpStatus.BAD_REQUEST,
                "Doorstep photo proof is required for Leave at Doorstep / Contactless delivery."
            );
        }

        boolean hasPhoto = hasText(req.proofPhotoUrl());
        if (hasPhoto) {
            p.setProofPhotoUrl(req.proofPhotoUrl().trim());
            p.setProofNote(hasText(req.proofNote()) ? req.proofNote().trim() : "Safe-drop photo captured at doorstep");
            p.setProofCapturedAt(LocalDateTime.now());
        }

        String handedOverTo = matchesDelegateOtp
            ? p.getDelegateName() + " (Delegate · Flat " + p.getDelegateFlat() + ")"
            : (hasText(p.getRecipientName()) ? p.getRecipientName() : "Flat " + p.getFlatNumber() + " Resident");
        p.setHandedOverTo(handedOverTo);

        String baseMethod = "QR_SCAN".equalsIgnoreCase(req.verificationSource())
            ? (matchesDelegateOtp ? "Delegate QR Pass + OTP" : "QR Pass + OTP")
            : (matchesDelegateOtp ? "Delegate OTP" : "6-Digit OTP");
        String verifiedMethod = hasPhoto ? baseMethod + " + Safe-Drop Photo" : baseMethod;
        p.setVerifiedMethod(verifiedMethod);

        p.setStatus(ParcelStatus.HANDED_OVER);
        p.setDemoOtp(null);
        p.setDelegateOtp(null);
        p.setHandedOverAt(LocalDateTime.now());
        Parcel saved = repository.save(p);

        String photoSuffix = hasPhoto ? " Doorstep photo proof attached to your receipt." : "";
        String delegateSuffix = matchesDelegateOtp
            ? " Collected by authorized delegate " + p.getDelegateName() + " (Flat " + p.getDelegateFlat() + ")."
            : "";

        notifyFlatResidents(
            saved,
            "Package Delivered · Tap to Rate",
            "Your " + saved.getCourier() + " parcel " + saved.getTrackingNumber()
                + " was verified via " + verifiedMethod + "." + delegateSuffix + photoSuffix
                + " Tap to give your 1–5 ★ delivery rating.",
            NotificationType.HANDOVER_COMPLETED
        );

        if (matchesDelegateOtp && hasText(saved.getDelegateFlat())
                && !saved.getDelegateFlat().equalsIgnoreCase(saved.getFlatNumber())) {
            notifyUsersInFlat(
                saved.getDelegateFlat(),
                saved.getId(),
                "Delegate Handover Completed",
                "Collected parcel " + saved.getTrackingNumber() + " on behalf of Flat " + saved.getFlatNumber() + "." + photoSuffix,
                NotificationType.HANDOVER_COMPLETED
            );
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Parcel handed over successfully");
        response.put("parcelId", saved.getId());
        response.put("handedOverAt", saved.getHandedOverAt().toString());
        response.put("verifiedMethod", verifiedMethod);
        response.put("handedOverTo", handedOverTo);
        response.put("parcel", saved);
        return response;
    }

    @PostMapping("/bundle")
    @Transactional
    public Map<String, Object> bundleParcels(@RequestBody BundleSlotRequest req) {
        String flat = hasText(req.flatNumber()) ? req.flatNumber().trim().toUpperCase(Locale.ROOT) : null;
        if (flat == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "flatNumber is required to bundle parcels");
        }

        List<Parcel> candidates;
        if (req.parcelIds() != null && !req.parcelIds().isEmpty()) {
            candidates = repository.findAllById(req.parcelIds()).stream()
                .filter(p -> p.getFlatNumber().equalsIgnoreCase(flat))
                .filter(p -> p.getStatus() == ParcelStatus.RECEIVED || p.getStatus() == ParcelStatus.SLOT_BOOKED)
                .toList();
        } else {
            candidates = repository.findByFlatNumberOrderByReceivedAtDesc(flat).stream()
                .filter(p -> p.getStatus() == ParcelStatus.RECEIVED || p.getStatus() == ParcelStatus.SLOT_BOOKED)
                .toList();
        }

        if (candidates.size() < 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "At least 2 active parcels for Flat " + flat + " are required to bundle");
        }

        String bundleCode = "BNDL-" + flat.replace("-", "") + "-" + (1000 + random.nextInt(9000));
        String masterOtp = String.valueOf(100000 + random.nextInt(900000));
        String slot = hasText(req.slot()) ? req.slot().trim() : (candidates.get(0).getSlot() != null ? candidates.get(0).getSlot() : "4:00 PM – 6:00 PM");
        String prefDate = hasText(req.preferredDate()) ? req.preferredDate().trim() : (candidates.get(0).getPreferredDate() != null ? candidates.get(0).getPreferredDate() : "Today");
        String instruction = hasText(req.deliveryInstruction()) ? req.deliveryInstruction().trim() : null;

        List<Parcel> updated = new ArrayList<>();
        List<String> couriers = new ArrayList<>();
        for (Parcel p : candidates) {
            p.setBundled(true);
            p.setBundleCode(bundleCode);
            p.setBundleSize(candidates.size());
            p.setMasterOtp(masterOtp);
            p.setDemoOtp(masterOtp);
            p.setSlot(slot);
            p.setPreferredDate(prefDate);
            p.setStatus(ParcelStatus.SLOT_BOOKED);
            if (instruction != null) {
                p.setDeliveryInstruction(instruction);
            }
            resetAgentScheduleConfirmation(p);
            updated.add(repository.save(p));
            couriers.add(p.getCourier());
        }

        String courierSummary = String.join(", ", couriers);
        notifyFlatResidents(
            updated.get(0),
            "📦 " + updated.size() + " Parcels Bundled · Master Pass Ready",
            "Parcels from " + courierSummary + " are grouped into 1 delivery window (" + slot + ") for Flat " + flat + ". Single Master OTP: " + masterOtp,
            NotificationType.BUNDLE_CONFIRMED
        );

        notifyDeliveryAgents(
            updated.get(0),
            "Multi-Parcel Bundle · Flat " + flat,
            updated.size() + " parcels bundled for Flat " + flat + " (" + courierSummary + ") under Master Pass " + bundleCode + ".",
            NotificationType.BUNDLE_CONFIRMED
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("message", "Successfully bundled " + updated.size() + " parcels for Flat " + flat);
        res.put("bundleCode", bundleCode);
        res.put("bundleSize", updated.size());
        res.put("masterOtp", masterOtp);
        res.put("slot", slot);
        res.put("preferredDate", prefDate);
        res.put("parcels", updated);
        return res;
    }

    @PostMapping("/bundle-handover")
    @Transactional
    public Map<String, Object> handoverBundle(@RequestBody BundleHandoverRequest req) {
        if (!hasText(req.bundleCode())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "bundleCode is required");
        }
        String bCode = req.bundleCode().trim();
        List<Parcel> bundled = repository.findByBundleCode(bCode);
        if (bundled.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "No parcels found for bundle: " + bCode);
        }

        Parcel sample = bundled.get(0);
        String expectedOtp = sample.getMasterOtp() != null ? sample.getMasterOtp() : sample.getDemoOtp();
        boolean isQr = "MASTER_QR".equalsIgnoreCase(req.verifiedMethod()) || "QR_SCAN".equalsIgnoreCase(req.verifiedMethod());
        boolean otpMatches = expectedOtp != null && expectedOtp.equalsIgnoreCase(req.otp() != null ? req.otp().trim() : "");

        if (!otpMatches && !isQr) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Master Pass OTP for bundle " + bCode);
        }

        boolean safeDropReq = bundled.stream().anyMatch(this::isSafeDropRequired);
        if (safeDropReq && !hasText(req.proofPhotoUrl())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Doorstep photo proof is required for Leave at Doorstep / Contactless bundle handover.");
        }

        boolean hasPhoto = hasText(req.proofPhotoUrl());
        String photoUrl = hasPhoto ? req.proofPhotoUrl().trim() : null;
        String proofNote = hasText(req.proofNote()) ? req.proofNote().trim() : "Bundled handover (" + bundled.size() + " parcels)";
        LocalDateTime now = LocalDateTime.now();
        String agent = hasText(req.agentName()) ? req.agentName().trim() : "Delivery Partner";
        String verifiedMethod = isQr
            ? "Master QR Pass (" + bundled.size() + " Parcels)"
            : "Master OTP (" + bundled.size() + " Parcels)";
        if (hasPhoto) verifiedMethod += " + Doorstep Photo";

        List<Parcel> handedOver = new ArrayList<>();
        List<String> couriers = new ArrayList<>();
        for (Parcel p : bundled) {
            p.setStatus(ParcelStatus.HANDED_OVER);
            p.setHandedOverAt(now);
            p.setDemoOtp(null);
            p.setMasterOtp(null);
            p.setVerifiedMethod(verifiedMethod);
            p.setHandedOverTo("Flat " + p.getFlatNumber() + " Resident (Bundled Drop)");
            if (photoUrl != null) {
                p.setProofPhotoUrl(photoUrl);
                p.setProofNote(proofNote);
                p.setProofCapturedAt(now);
            }
            p.setAgentName(agent);
            handedOver.add(repository.save(p));
            couriers.add(p.getCourier());
        }

        String courierList = String.join(", ", couriers);
        notifyFlatResidents(
            sample,
            "Package Delivered · Tap to Rate",
            "All " + handedOver.size() + " bundled parcels (" + courierList + ") were delivered together via " + verifiedMethod + ". Tap to rate your delivery.",
            NotificationType.HANDOVER_COMPLETED
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("message", "Handover completed for " + handedOver.size() + " bundled parcels");
        res.put("bundleCode", bCode);
        res.put("count", handedOver.size());
        res.put("verifiedMethod", verifiedMethod);
        res.put("handedOverAt", now.toString());
        res.put("parcels", handedOver);
        return res;
    }

    @PostMapping("/return-pickup")
    public Parcel scheduleReturnPickup(@RequestBody ReturnPickupRequest req) {
        if (!hasText(req.courier())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "courier is required");
        }
        if (!hasText(req.flatNumber())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "flatNumber is required");
        }

        String flat = req.flatNumber().trim().toUpperCase(Locale.ROOT);
        String courier = req.courier().trim();
        String shortCourier = courier.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        if (shortCourier.length() > 6) shortCourier = shortCourier.substring(0, shortCourier.length());
        String tracking = "RET-" + shortCourier + "-" + (10000 + random.nextInt(90000));
        String returnOtp = String.valueOf(100000 + random.nextInt(900000));

        Parcel p = new Parcel();
        p.setTrackingNumber(tracking);
        p.setCourier(courier);
        p.setFlatNumber(flat);
        p.setRecipientName(hasText(req.recipientName()) ? req.recipientName().trim() : "Resident Flat " + flat);
        p.setRecipientPhone(hasText(req.recipientPhone()) ? req.recipientPhone().trim() : "");
        p.setCategory("Return Package");
        p.setDescription("Return package for " + courier + (hasText(req.returnReason()) ? " · " + req.returnReason().trim() : ""));
        p.setReturnPickup(true);
        p.setReturnReason(hasText(req.returnReason()) ? req.returnReason().trim() : "Customer Return");
        p.setReturnOriginalTracking(hasText(req.originalTrackingNumber()) ? req.originalTrackingNumber().trim() : null);
        p.setReturnStatus("SCHEDULED");
        p.setReturnOtp(returnOtp);
        p.setDemoOtp(returnOtp);
        p.setReturnScheduledAt(LocalDateTime.now());
        p.setSlot(hasText(req.slot()) ? req.slot().trim() : "4:00 PM – 6:00 PM");
        p.setPreferredDate(hasText(req.preferredDate()) ? req.preferredDate().trim() : "Today");
        p.setDeliveryInstruction(hasText(req.deliveryInstruction()) ? req.deliveryInstruction().trim() : "Hand over return box to agent at doorstep");
        p.setStatus(ParcelStatus.SLOT_BOOKED);

        Parcel saved = repository.save(p);

        notifyFlatResidents(
            saved,
            "🔄 Return Pickup Scheduled · " + saved.getCourier(),
            "Return ID " + saved.getTrackingNumber() + " scheduled for " + saved.getSlot() + ". Share Reverse OTP " + returnOtp + " with courier agent on collection.",
            NotificationType.RETURN_SCHEDULED
        );

        notifyDeliveryAgents(
            saved,
            "🔄 Return Collection · Flat " + saved.getFlatNumber(),
            "Return pickup scheduled for " + saved.getCourier() + " at Flat " + saved.getFlatNumber() + " (" + saved.getSlot() + ").",
            NotificationType.RETURN_SCHEDULED
        );

        return saved;
    }

    @PostMapping("/{id}/confirm-return-pickup")
    public Map<String, Object> confirmReturnPickup(@PathVariable Long id, @RequestBody(required = false) HandoverRequest req) {
        Parcel p = get(id);
        if (!p.isReturnPickup()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Parcel " + p.getTrackingNumber() + " is not a return pickup.");
        }
        if (p.getStatus() == ParcelStatus.HANDED_OVER || "PICKED_UP".equalsIgnoreCase(p.getReturnStatus())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Return parcel already collected.");
        }

        String providedOtp = (req != null && hasText(req.otp())) ? req.otp().trim() : null;
        boolean isQrScan = req != null && "QR_SCAN".equalsIgnoreCase(req.verificationSource());
        boolean otpMatches = (p.getReturnOtp() != null && p.getReturnOtp().equalsIgnoreCase(providedOtp))
            || (p.getDemoOtp() != null && p.getDemoOtp().equalsIgnoreCase(providedOtp));

        if (!otpMatches && !isQrScan) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid Reverse-Handover OTP for return " + p.getTrackingNumber());
        }

        LocalDateTime now = LocalDateTime.now();
        boolean hasPhoto = req != null && hasText(req.proofPhotoUrl());
        if (hasPhoto) {
            p.setProofPhotoUrl(req.proofPhotoUrl().trim());
            p.setProofNote(hasText(req.proofNote()) ? req.proofNote().trim() : "Return package condition verified & collected at doorstep");
            p.setProofCapturedAt(now);
        }

        String method = isQrScan ? "Reverse QR Pass" : "Reverse-Handover OTP";
        if (hasPhoto) method += " + Return Proof Photo";

        p.setStatus(ParcelStatus.HANDED_OVER);
        p.setReturnStatus("PICKED_UP");
        p.setReturnPickedUpAt(now);
        p.setHandedOverAt(now);
        p.setVerifiedMethod(method);
        p.setHandedOverTo(p.getCourier() + " Return Courier");
        p.setDemoOtp(null);
        p.setReturnOtp(null);

        Parcel saved = repository.save(p);

        notifyFlatResidents(
            saved,
            "🔄 Return Package Collected · " + saved.getCourier(),
            "Your return parcel " + saved.getTrackingNumber() + " was verified via " + method + " and handed over to " + saved.getCourier() + ". Return receipt ready.",
            NotificationType.RETURN_PICKED_UP
        );

        Map<String, Object> res = new LinkedHashMap<>();
        res.put("message", "Return parcel collected successfully");
        res.put("parcelId", saved.getId());
        res.put("pickedUpAt", now.toString());
        res.put("verifiedMethod", method);
        res.put("parcel", saved);
        return res;
    }

    @PostMapping("/{id}/issue")
    public Parcel reportIssue(@PathVariable Long id, @Valid @RequestBody ReportIssueRequest req) {
        Parcel p = get(id);
        if (p.getStatus() != ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Post-delivery issues can only be reported once a parcel has been delivered."
            );
        }
        if (p.isIssueReported()) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "An issue report is already logged for parcel " + p.getTrackingNumber() + "."
            );
        }
        if (p.getHandedOverAt() != null && p.getHandedOverAt().plusDays(ISSUE_WINDOW_DAYS).isBefore(LocalDateTime.now())) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "The " + ISSUE_WINDOW_DAYS + "-day post-delivery dispute window has closed."
            );
        }

        String category = req.category().trim();
        String notes = req.notes().trim();
        p.setIssueReported(true);
        p.setIssueCategory(category);
        p.setIssueNotes(notes);
        p.setIssuePhotoUrl(hasText(req.photoUrl()) ? req.photoUrl().trim() : null);
        p.setIssueStatus("OPEN");
        p.setIssueReportedAt(LocalDateTime.now());
        p.setIssueResolutionNote(null);
        p.setIssueResolvedAt(null);

        Parcel saved = repository.save(p);
        String reporter = hasText(req.reportedBy()) ? req.reportedBy().trim()
            : (hasText(saved.getRecipientName()) ? saved.getRecipientName() : "Flat " + saved.getFlatNumber() + " Resident");

        messageRepository.save(new ParcelMessage(
            saved.getId(),
            null,
            reporter,
            UserRole.ROLE_RESIDENT,
            "[Dispute Flag · " + category + "] " + notes
        ));

        notifyDeliveryAgents(
            saved,
            "Issue Reported · Flat " + saved.getFlatNumber(),
            reporter + " flagged parcel " + saved.getTrackingNumber() + " (" + category + "): " + notes,
            NotificationType.ISSUE_REPORTED
        );

        notifyAdmins(
            saved,
            "Delivery Dispute Open · " + saved.getTrackingNumber(),
            "Flat " + saved.getFlatNumber() + " reported \"" + category + "\" on " + saved.getCourier()
                + " parcel " + saved.getTrackingNumber() + ".",
            NotificationType.ISSUE_REPORTED
        );

        return saved;
    }

    @PatchMapping("/{id}/issue/resolve")
    public Parcel resolveIssue(@PathVariable Long id, @Valid @RequestBody ResolveIssueRequest req) {
        Parcel p = get(id);
        if (!p.isIssueReported()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "No issue report found for this parcel.");
        }

        String normalizedStatus = hasText(req.status()) ? req.status().trim().toUpperCase(Locale.ROOT) : "RESOLVED";
        if (!"INVESTIGATING".equals(normalizedStatus) && !"RESOLVED".equals(normalizedStatus)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Issue status must be INVESTIGATING or RESOLVED.");
        }

        String note = hasText(req.resolutionNote()) ? req.resolutionNote().trim() : null;
        String actor = hasText(req.resolvedBy()) ? req.resolvedBy().trim() : "SmartParcel Audit";

        p.setIssueStatus(normalizedStatus);
        p.setIssueResolutionNote(note);
        p.setIssueResolvedAt("RESOLVED".equals(normalizedStatus) ? LocalDateTime.now() : null);

        Parcel saved = repository.save(p);
        String noteText = note != null ? note : ("Status updated to " + normalizedStatus);

        messageRepository.save(new ParcelMessage(
            saved.getId(),
            null,
            actor,
            UserRole.ROLE_ADMIN,
            "[Dispute " + normalizedStatus + "] " + noteText
        ));

        notifyFlatResidents(
            saved,
            "Issue " + ("RESOLVED".equals(normalizedStatus) ? "Resolved" : "Under Review") + " · " + saved.getTrackingNumber(),
            actor + " updated your dispute for " + saved.getCourier() + " (" + saved.getTrackingNumber() + "): " + noteText,
            NotificationType.ISSUE_RESOLVED
        );

        return saved;
    }

    @PostMapping("/{id}/rate")
    public Map<String, Object> rateDelivery(@PathVariable Long id, @Valid @RequestBody RateParcelRequest req) {
        Parcel p = get(id);
        if (p.getStatus() != ParcelStatus.HANDED_OVER) {
            throw new ResponseStatusException(
                HttpStatus.CONFLICT,
                "Deliveries can only be rated after handover is completed."
            );
        }

        boolean isFirstRating = p.getRatedAt() == null;
        String joinedTags = (req.tags() == null || req.tags().isEmpty())
            ? null
            : req.tags().stream()
                .filter(Objects::nonNull)
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .distinct()
                .collect(Collectors.joining(", "));
        if (joinedTags != null && joinedTags.isEmpty()) {
            joinedTags = null;
        }

        p.setDeliveryRating(req.rating());
        p.setRatingTags(joinedTags);
        p.setRatingComment(hasText(req.comment()) ? req.comment().trim() : null);
        p.setRatedAt(LocalDateTime.now());
        Parcel saved = repository.save(p);

        if (isFirstRating) {
            String tagSuffix = joinedTags != null ? " (" + joinedTags + ")" : "";
            notifyDeliveryAgents(
                saved,
                saved.getDeliveryRating() + "★ Rating Received · Flat " + saved.getFlatNumber(),
                "Resident rated delivery " + saved.getTrackingNumber() + " " + saved.getDeliveryRating() + "/5 stars" + tagSuffix + ".",
                NotificationType.RATING_RECEIVED
            );
        }

        Map<String, Object> agentTrust = agentTrustService.buildAgentTrustSummary(
            repository.findAll(),
            userRepository.findByRole(UserRole.ROLE_DELIVERY_AGENT)
        );

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("message", "Thank you! Rating submitted.");
        response.put("parcel", saved);
        response.put("agentTrust", agentTrust);
        return response;
    }

    @DeleteMapping("/{id}")
    @Transactional
    public Map<String, Object> delete(@PathVariable Long id) {
        Parcel p = get(id);
        messageRepository.deleteByParcelId(id);
        repository.delete(p);
        return Map.of("message", "Parcel deleted successfully", "parcelId", id);
    }

    @PostMapping("/seed")
    @Transactional
    public Map<String, Object> seedDemoData() {
        messageRepository.deleteAll();
        repository.deleteAll();

        User agent = resolveDefaultAgent();
        Long agentId = agent != null ? agent.getId() : null;
        String agentName = agent != null ? agent.getName() : "Ramesh Kumar (Delivery Agent)";
        String agentPhone = agent != null ? agent.getPhone() : "+91 98765 00002";

        List<Parcel> seedList = new ArrayList<>();

        Parcel p1 = new Parcel();
        p1.setTrackingNumber("AMZ-8201");
        p1.setCourier("Amazon");
        p1.setFlatNumber("A-101");
        p1.setRecipientName("Aarav Sharma");
        p1.setRecipientPhone("+91 98765 12001");
        p1.setCategory("Electronics");
        p1.setDescription("Wireless Headphones & Adapter");
        p1.setStatus(ParcelStatus.RECEIVED);
        p1.setReceivedAt(LocalDateTime.now().minusHours(2));
        p1.setAgentId(agentId);
        p1.setAgentName(agentName);
        p1.setAgentPhone(agentPhone);
        p1.setDeliveryInstruction("Call on arrival");
        seedList.add(p1);

        Parcel p2 = new Parcel();
        p2.setTrackingNumber("FK-4019");
        p2.setCourier("Flipkart");
        p2.setFlatNumber("A-101");
        p2.setRecipientName("Pooja Sharma");
        p2.setRecipientPhone("+91 98765 12001");
        p2.setCategory("Box");
        p2.setDescription("Kitchen Appliances set");
        p2.setStatus(ParcelStatus.SLOT_BOOKED);
        p2.setSlot("4:00 PM – 6:00 PM");
        p2.setDemoOtp("482910");
        p2.setReceivedAt(LocalDateTime.now().minusHours(4));
        p2.setAgentId(agentId);
        p2.setAgentName(agentName);
        p2.setAgentPhone(agentPhone);
        p2.setDeliveryInstruction("Hand over personally");
        seedList.add(p2);

        Parcel p3 = new Parcel();
        p3.setTrackingNumber("DEL-9142");
        p3.setCourier("Delhivery");
        p3.setFlatNumber("A-102");
        p3.setRecipientName("Rajesh Patel");
        p3.setRecipientPhone("+91 98765 34102");
        p3.setCategory("Box");
        p3.setDescription("Sports Running Shoes");
        p3.setStatus(ParcelStatus.HANDED_OVER);
        p3.setSlot("10:00 AM – 12:00 PM");
        p3.setReceivedAt(LocalDateTime.now().minusHours(7));
        p3.setHandedOverAt(LocalDateTime.now().minusHours(1));
        p3.setAgentId(agentId);
        p3.setAgentName(agentName);
        p3.setAgentPhone(agentPhone);
        p3.setDeliveryInstruction("Hand over personally");
        seedList.add(p3);

        Parcel p4 = new Parcel();
        p4.setTrackingNumber("BLU-3091");
        p4.setCourier("BlueDart");
        p4.setFlatNumber("B-201");
        p4.setRecipientName("Dr. Vikram Rao");
        p4.setRecipientPhone("+91 98765 55201");
        p4.setCategory("Document");
        p4.setDescription("Urgent Legal & Bank Papers");
        p4.setStatus(ParcelStatus.RECEIVED);
        p4.setReceivedAt(LocalDateTime.now().minusMinutes(45));
        p4.setAgentId(agentId);
        p4.setAgentName(agentName);
        p4.setAgentPhone(agentPhone);
        p4.setDeliveryInstruction("Hand over personally");
        seedList.add(p4);

        Parcel p5 = new Parcel();
        p5.setTrackingNumber("IP-7714");
        p5.setCourier("India Post");
        p5.setFlatNumber("B-202");
        p5.setRecipientName("Meera Nambiar");
        p5.setRecipientPhone("+91 98765 77202");
        p5.setCategory("Fragile");
        p5.setDescription("Ceramic Dinnerware");
        p5.setStatus(ParcelStatus.RESCHEDULED);
        p5.setPreferredDate(LocalDate.now().plusDays(1).toString());
        p5.setSlot("7:00 PM – 9:00 PM");
        p5.setRescheduleReason("Out of station today, back tomorrow evening");
        p5.setRescheduledOnce(true);
        p5.setReceivedAt(LocalDateTime.now().minusHours(5));
        p5.setAgentId(agentId);
        p5.setAgentName(agentName);
        p5.setAgentPhone(agentPhone);
        p5.setDeliveryInstruction("Hand over personally");
        seedList.add(p5);

        Parcel p6 = new Parcel();
        p6.setTrackingNumber("DTDC-6290");
        p6.setCourier("DTDC");
        p6.setFlatNumber("C-301");
        p6.setRecipientName("Kavita Menon");
        p6.setRecipientPhone("+91 98765 99301");
        p6.setCategory("Box");
        p6.setDescription("Designer Apparel");
        p6.setStatus(ParcelStatus.HANDED_OVER);
        p6.setSlot("1:00 PM – 3:00 PM");
        p6.setReceivedAt(LocalDateTime.now().minusDays(1));
        p6.setHandedOverAt(LocalDateTime.now().minusHours(3));
        p6.setAgentId(agentId);
        p6.setAgentName(agentName);
        p6.setAgentPhone(agentPhone);
        seedList.add(p6);

        List<Parcel> savedParcels = repository.saveAll(seedList);

        // Seed sample direct Delivery Agent <-> Resident messages
        Parcel savedP1 = savedParcels.get(0);
        Parcel savedP2 = savedParcels.get(1);
        messageRepository.saveAll(List.of(
            new ParcelMessage(savedP1.getId(), agentId, agentName, UserRole.ROLE_DELIVERY_AGENT,
                "Hi Aarav! I have arrived at Palm Meadows with your Amazon electronics package. Are you available at Flat A-101?"),
            new ParcelMessage(savedP1.getId(), null, "Aarav Sharma", UserRole.ROLE_RESIDENT,
                "Yes, please call me when you reach the 1st floor lift."),
            new ParcelMessage(savedP2.getId(), agentId, agentName, UserRole.ROLE_DELIVERY_AGENT,
                "Your Flipkart kitchen appliances parcel is scheduled for 4:00 PM – 6:00 PM. Your handover OTP is ready!")
        ));

        return Map.of(
            "message", "Demo database seeded with direct Delivery Agent & Resident workflows",
            "count", savedParcels.size()
        );
    }

    @PostMapping("/reset")
    @Transactional
    public Map<String, Object> resetDemoData() {
        messageRepository.deleteAll();
        repository.deleteAll();
        return Map.of("message", "All parcel records cleared successfully");
    }

    private Parcel get(Long id) {
        return repository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Parcel not found with id: " + id));
    }

    private User resolveDefaultAgent() {
        List<User> agents = userRepository.findByRole(UserRole.ROLE_DELIVERY_AGENT);
        return agents.stream().filter(User::isActive).findFirst().orElse(agents.isEmpty() ? null : agents.get(0));
    }

    private void notifyFlatResidents(Parcel parcel, String title, String body, NotificationType type) {
        notifyUsersInFlat(parcel.getFlatNumber(), parcel.getId(), title, body, type);
    }

    private void notifyUsersInFlat(String flatNumber, Long parcelId, String title, String body, NotificationType type) {
        if (!hasText(flatNumber)) {
            return;
        }
        List<User> residents = userRepository.findByFlatNumber(flatNumber.trim().toUpperCase());
        for (User resident : residents) {
            notificationRepository.save(new Notification(resident.getId(), parcelId, title, body, type));
        }
    }

    private void notifyDeliveryAgents(Parcel parcel, String title, String body, NotificationType type) {
        if (parcel.getAgentId() != null) {
            Optional<User> assigned = userRepository.findById(parcel.getAgentId());
            if (assigned.isPresent()) {
                notificationRepository.save(new Notification(assigned.get().getId(), parcel.getId(), title, body, type));
                return;
            }
        }
        List<User> agents = userRepository.findByRole(UserRole.ROLE_DELIVERY_AGENT);
        for (User agent : agents) {
            notificationRepository.save(new Notification(agent.getId(), parcel.getId(), title, body, type));
        }
    }

    private void notifyAdmins(Parcel parcel, String title, String body, NotificationType type) {
        List<User> admins = userRepository.findByRole(UserRole.ROLE_ADMIN);
        for (User admin : admins) {
            if (admin.isActive()) {
                notificationRepository.save(new Notification(admin.getId(), parcel.getId(), title, body, type));
            }
        }
    }

    private boolean isSafeDropRequired(Parcel parcel) {
        if (parcel == null || !hasText(parcel.getDeliveryInstruction())) {
            return false;
        }
        String inst = parcel.getDeliveryInstruction().toLowerCase(Locale.ROOT);
        return inst.contains("doorstep")
            || inst.contains("contactless")
            || inst.contains("safe-drop")
            || inst.contains("outside door");
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
