package com.smartparcel.service;

import com.smartparcel.model.User;
import com.smartparcel.model.UserRole;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
public class ResidentPreferencesService {

    public Optional<User> resolveFlatPreferenceOwner(List<User> residentsInFlat, LocalDate today) {
        if (residentsInFlat == null || residentsInFlat.isEmpty()) {
            return Optional.empty();
        }
        List<User> activeResidents = residentsInFlat.stream()
            .filter(User::isActive)
            .filter(u -> u.getRole() == UserRole.ROLE_RESIDENT)
            .toList();

        Optional<User> onVacation = activeResidents.stream()
            .filter(u -> isVacationActiveOn(u, today))
            .findFirst();
        if (onVacation.isPresent()) {
            return onVacation;
        }

        return activeResidents.stream()
            .filter(this::hasAnySavedPreference)
            .findFirst();
    }

    public boolean hasAnySavedPreference(User user) {
        if (user == null) {
            return false;
        }
        return hasText(user.getDefaultInstruction())
            || hasText(user.getDefaultSlot())
            || user.isQuietHoursEnabled()
            || user.isVacationMode();
    }

    public boolean isVacationActiveOn(User resident, LocalDate date) {
        if (resident == null || !resident.isActive() || !resident.isVacationMode()) {
            return false;
        }
        LocalDate from = parseIsoDate(resident.getVacationFrom());
        LocalDate until = parseIsoDate(resident.getVacationUntil());
        if (from != null && date.isBefore(from)) {
            return false;
        }
        if (until != null && date.isAfter(until)) {
            return false;
        }
        return true;
    }

    public LocalDate computePostVacationDeliveryDate(User resident, LocalDate today) {
        LocalDate until = resident != null ? parseIsoDate(resident.getVacationUntil()) : null;
        if (until != null && !until.isBefore(today)) {
            return until.plusDays(1);
        }
        return today.plusDays(1);
    }

    public String buildEffectiveDefaultInstruction(User resident) {
        if (resident == null) {
            return null;
        }
        String base = trimToNull(resident.getDefaultInstruction());
        if (resident.isQuietHoursEnabled()) {
            String start = hasText(resident.getQuietHoursStart()) ? resident.getQuietHoursStart().trim() : "20:00";
            String end = hasText(resident.getQuietHoursEnd()) ? resident.getQuietHoursEnd().trim() : "07:00";
            String quietSuffix = "Quiet hours " + start + "–" + end;
            if (base == null) {
                return quietSuffix + " · Leave outside door";
            }
            if (!base.toLowerCase(Locale.ROOT).contains("quiet")) {
                return base + " (" + quietSuffix + ")";
            }
        }
        return base;
    }

    public Map<String, Object> toPreferencePayload(User user, LocalDate today) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("userId", user != null ? user.getId() : null);
        map.put("flatNumber", user != null ? user.getFlatNumber() : null);
        map.put("defaultInstruction", user != null ? user.getDefaultInstruction() : null);
        map.put("defaultSlot", user != null ? user.getDefaultSlot() : null);
        map.put("quietHoursEnabled", user != null && user.isQuietHoursEnabled());
        map.put("quietHoursStart", user != null ? user.getQuietHoursStart() : null);
        map.put("quietHoursEnd", user != null ? user.getQuietHoursEnd() : null);
        map.put("vacationMode", user != null && user.isVacationMode());
        map.put("vacationFrom", user != null ? user.getVacationFrom() : null);
        map.put("vacationUntil", user != null ? user.getVacationUntil() : null);
        map.put("vacationActiveToday", user != null && isVacationActiveOn(user, today));
        map.put("hasPreferences", hasAnySavedPreference(user));
        return map;
    }

    public LocalDate parseIsoDate(String raw) {
        if (!hasText(raw)) {
            return null;
        }
        try {
            return LocalDate.parse(raw.trim());
        } catch (DateTimeParseException ex) {
            return null;
        }
    }

    public String trimToNull(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}

