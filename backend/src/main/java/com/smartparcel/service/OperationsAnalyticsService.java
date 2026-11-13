package com.smartparcel.service;

import com.smartparcel.model.Parcel;
import com.smartparcel.model.ParcelStatus;
import com.smartparcel.model.User;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class OperationsAnalyticsService {

    public static final int SLA_TARGET_MINUTES = 240;
    public static final int SLA_WARNING_MINUTES = 180;
    public static final int EXPRESS_FAST_MINUTES = 15;

    private static final List<String> STANDARD_SLOTS = List.of(
        "8:00 AM – 10:00 AM",
        "10:00 AM – 12:00 PM",
        "1:00 PM – 3:00 PM",
        "4:00 PM – 6:00 PM",
        "7:00 PM – 9:00 PM"
    );

    public Map<String, Object> buildStatsPayload(List<Parcel> allParcels, List<User> agents, LocalDateTime now) {
        List<Parcel> safeParcels = allParcels != null ? allParcels : List.of();
        User fallbackAgent = (agents != null && !agents.isEmpty())
            ? agents.stream().filter(User::isActive).findFirst().orElse(agents.get(0))
            : null;
        Long fallbackAgentId = fallbackAgent != null ? fallbackAgent.getId() : null;

        long total = safeParcels.size();
        long pending = 0;
        long slotted = 0;
        long rescheduledStatus = 0;
        long completed = 0;
        long openIssues = 0;
        long rescheduledFrequencyCount = 0;

        Map<String, Long> courierShare = new LinkedHashMap<>();
        Map<String, Long> slotCounts = new LinkedHashMap<>();
        for (String slot : STANDARD_SLOTS) {
            slotCounts.put(slot, 0L);
        }
        slotCounts.put("Unscheduled", 0L);

        Map<String, Long> rescheduleReasonsMap = new HashMap<>();
        Map<Long, AgentSpeedAccumulator> agentSpeedMap = new LinkedHashMap<>();
        if (agents != null) {
            for (User a : agents) {
                agentSpeedMap.put(a.getId(), new AgentSpeedAccumulator(a.getId(), a.getName()));
            }
        }

        // Daily trend buckets (last 7 days inclusive)
        LocalDate today = now.toLocalDate();
        Map<LocalDate, DailyBucket> dailyMap = new LinkedHashMap<>();
        for (int offset = 6; offset >= 0; offset--) {
            LocalDate d = today.minusDays(offset);
            dailyMap.put(d, new DailyBucket(d));
        }

        // 4-hour arrival time blocks
        String[] hourBuckets = { "12a–4a", "4a–8a", "8a–12p", "12p–4p", "4p–8p", "8p–12a" };
        long[] hourBucketCounts = new long[6];

        long handedOverDurationSum = 0;
        long handedOverDurationCount = 0;
        long under15MinCompleted = 0;

        int under15mActive = 0;
        int onTrackActive = 0;
        int atRiskActive = 0;
        int overdueActive = 0;
        int escalatedCount = 0;
        List<Long> overdueParcelIds = new ArrayList<>();
        List<Long> atRiskParcelIds = new ArrayList<>();
        Map<String, Map<String, Object>> slaByParcelId = new LinkedHashMap<>();

        for (Parcel p : safeParcels) {
            if (p.getStatus() == ParcelStatus.RECEIVED) pending++;
            else if (p.getStatus() == ParcelStatus.SLOT_BOOKED) slotted++;
            else if (p.getStatus() == ParcelStatus.RESCHEDULED) rescheduledStatus++;
            else if (p.getStatus() == ParcelStatus.HANDED_OVER) completed++;

            if (p.isIssueReported() && !"RESOLVED".equalsIgnoreCase(p.getIssueStatus())) {
                openIssues++;
            }

            if (p.isRescheduledOnce()) {
                rescheduledFrequencyCount++;
                String reason = (p.getRescheduleReason() != null && !p.getRescheduleReason().isBlank())
                    ? p.getRescheduleReason().trim()
                    : "Resident Unavailable";
                rescheduleReasonsMap.merge(reason, 1L, Long::sum);
            }

            String courier = (p.getCourier() != null && !p.getCourier().isBlank()) ? p.getCourier().trim() : "Other";
            courierShare.merge(courier, 1L, Long::sum);

            String canonicalSlot = canonicalizeSlot(p.getSlot());
            slotCounts.merge(canonicalSlot, 1L, Long::sum);

            if (p.getReceivedAt() != null) {
                LocalDate recDate = p.getReceivedAt().toLocalDate();
                DailyBucket recBucket = dailyMap.get(recDate);
                if (recBucket != null) {
                    recBucket.dispatched++;
                    if (p.isRescheduledOnce()) recBucket.rescheduled++;
                }
                int hIdx = Math.min(5, Math.max(0, p.getReceivedAt().getHour() / 4));
                hourBucketCounts[hIdx]++;
            }
            if (p.getStatus() == ParcelStatus.HANDED_OVER && p.getHandedOverAt() != null) {
                DailyBucket delBucket = dailyMap.get(p.getHandedOverAt().toLocalDate());
                if (delBucket != null) {
                    delBucket.delivered++;
                }
            }

            // Compute per-parcel SLA metrics
            Map<String, Object> slaItem = computeParcelSla(p, now);
            if (p.getId() != null) {
                slaByParcelId.put(String.valueOf(p.getId()), slaItem);
            }

            Long ownerId = p.getAgentId() != null ? p.getAgentId() : fallbackAgentId;
            String ownerName = (p.getAgentName() != null && !p.getAgentName().isBlank())
                ? p.getAgentName()
                : (fallbackAgent != null ? fallbackAgent.getName() : "Delivery Partner");
            AgentSpeedAccumulator speedAcc = ownerId != null
                ? agentSpeedMap.computeIfAbsent(ownerId, id -> new AgentSpeedAccumulator(id, ownerName))
                : null;

            if (p.getStatus() == ParcelStatus.HANDED_OVER) {
                Long dur = (Long) slaItem.get("durationMinutes");
                if (dur != null) {
                    handedOverDurationSum += dur;
                    handedOverDurationCount++;
                    if (dur < EXPRESS_FAST_MINUTES) {
                        under15MinCompleted++;
                    }
                    if (speedAcc != null) {
                        speedAcc.completedCount++;
                        speedAcc.durationSumMinutes += dur;
                        if (dur < EXPRESS_FAST_MINUTES) speedAcc.under15MinCount++;
                    }
                }
            } else if (p.getStatus() != ParcelStatus.RESCHEDULED) {
                String tier = (String) slaItem.get("tier");
                if ("EXPRESS_FRESH".equals(tier)) under15mActive++;
                else if ("ON_TRACK".equals(tier)) onTrackActive++;
                else if ("SLA_RISK".equals(tier)) {
                    atRiskActive++;
                    if (p.getId() != null) atRiskParcelIds.add(p.getId());
                    if (speedAcc != null) speedAcc.openSlaRisks++;
                } else if ("OVERDUE".equals(tier)) {
                    overdueActive++;
                    if (p.getId() != null) {
                        overdueParcelIds.add(p.getId());
                        atRiskParcelIds.add(p.getId());
                    }
                    if (speedAcc != null) speedAcc.openSlaRisks++;
                }
                if (p.isSlaEscalated()) {
                    escalatedCount++;
                }
            }
        }

        // Courier share breakdown sorted desc
        List<Map<String, Object>> courierBreakdown = courierShare.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder())
                .thenComparing(Map.Entry.comparingByKey()))
            .map(e -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("courier", e.getKey());
                m.put("count", e.getValue());
                m.put("percent", total > 0 ? roundOneDecimal(e.getValue() * 100.0 / total) : 0.0);
                return m;
            })
            .toList();

        // Peak Delivery Time Slots breakdown
        List<Map<String, Object>> slotBreakdown = new ArrayList<>();
        String peakSlot = "None yet";
        long peakSlotCount = 0;
        for (Map.Entry<String, Long> e : slotCounts.entrySet()) {
            long c = e.getValue();
            if (!"Unscheduled".equals(e.getKey()) && c > peakSlotCount) {
                peakSlotCount = c;
                peakSlot = e.getKey();
            }
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("slot", e.getKey());
            m.put("shortLabel", shortenSlotLabel(e.getKey()));
            m.put("count", c);
            m.put("percent", total > 0 ? roundOneDecimal(c * 100.0 / total) : 0.0);
            slotBreakdown.add(m);
        }

        // Reschedule reasons sorted desc
        List<Map<String, Object>> rescheduleReasons = rescheduleReasonsMap.entrySet().stream()
            .sorted(Map.Entry.<String, Long>comparingByValue(Comparator.reverseOrder()))
            .limit(4)
            .map(e -> {
                Map<String, Object> m = new LinkedHashMap<>();
                m.put("reason", e.getKey());
                m.put("count", e.getValue());
                return m;
            })
            .toList();

        // Daily Trends
        List<Map<String, Object>> dailyTrends = dailyMap.values().stream()
            .map(DailyBucket::toMap)
            .toList();

        // Hourly Arrival distribution
        List<Map<String, Object>> hourlyArrivals = new ArrayList<>();
        String peakArrivalHour = "N/A";
        long maxHourCount = 0;
        for (int i = 0; i < hourBuckets.length; i++) {
            if (hourBucketCounts[i] > maxHourCount) {
                maxHourCount = hourBucketCounts[i];
                peakArrivalHour = hourBuckets[i];
            }
            Map<String, Object> hm = new LinkedHashMap<>();
            hm.put("bucket", hourBuckets[i]);
            hm.put("count", hourBucketCounts[i]);
            hourlyArrivals.add(hm);
        }

        // Agent speed leaderboard
        List<Map<String, Object>> agentSpeedLeaderboard = agentSpeedMap.values().stream()
            .map(AgentSpeedAccumulator::toMap)
            .sorted((a, b) -> {
                Double ma = (Double) a.get("avgHandoverMinutes");
                Double mb = (Double) b.get("avgHandoverMinutes");
                if (ma == null && mb == null) return 0;
                if (ma == null) return 1;
                if (mb == null) return -1;
                return Double.compare(ma, mb);
            })
            .toList();

        Double avgHandoverMinutes = handedOverDurationCount > 0
            ? roundOneDecimal((double) handedOverDurationSum / handedOverDurationCount)
            : null;
        double under15Rate = handedOverDurationCount > 0
            ? roundOneDecimal(under15MinCompleted * 100.0 / handedOverDurationCount)
            : 0.0;
        double rescheduleRatePercent = total > 0
            ? roundOneDecimal(rescheduledFrequencyCount * 100.0 / total)
            : 0.0;

        Map<String, Object> slaSummary = new LinkedHashMap<>();
        slaSummary.put("slaTargetMinutes", SLA_TARGET_MINUTES);
        slaSummary.put("under15mActive", under15mActive);
        slaSummary.put("onTrackCount", onTrackActive);
        slaSummary.put("atRiskCount", atRiskActive);
        slaSummary.put("overdueCount", overdueActive);
        slaSummary.put("totalAlertsCount", atRiskActive + overdueActive);
        slaSummary.put("escalatedCount", escalatedCount);
        slaSummary.put("overdueParcelIds", overdueParcelIds);
        slaSummary.put("atRiskParcelIds", atRiskParcelIds);
        slaSummary.put("itemsByParcelId", slaByParcelId);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("total", total);
        response.put("pending", pending);
        response.put("slotted", slotted);
        response.put("rescheduled", rescheduledStatus);
        response.put("completed", completed);
        response.put("openIssues", openIssues);
        response.put("activeAtDesk", pending + slotted + rescheduledStatus);
        response.put("courierShare", courierShare);
        response.put("courierBreakdown", courierBreakdown);
        response.put("slotBreakdown", slotBreakdown);
        response.put("peakSlot", peakSlot);
        response.put("rescheduledFrequencyCount", rescheduledFrequencyCount);
        response.put("rescheduleRatePercent", rescheduleRatePercent);
        response.put("rescheduleReasons", rescheduleReasons);
        response.put("avgHandoverMinutes", avgHandoverMinutes);
        response.put("under15MinCount", under15MinCompleted);
        response.put("under15MinRatePercent", under15Rate);
        response.put("agentSpeedLeaderboard", agentSpeedLeaderboard);
        response.put("dailyTrends", dailyTrends);
        response.put("hourlyArrivals", hourlyArrivals);
        response.put("peakArrivalHour", peakArrivalHour);
        response.put("slaSummary", slaSummary);
        return response;
    }

    public Map<String, Object> computeParcelSla(Parcel p, LocalDateTime now) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("parcelId", p.getId());
        item.put("trackingNumber", p.getTrackingNumber());
        item.put("flatNumber", p.getFlatNumber());
        item.put("courier", p.getCourier());
        item.put("status", p.getStatus() != null ? p.getStatus().name() : null);
        item.put("isEscalated", p.isSlaEscalated());

        if (p.getStatus() == ParcelStatus.HANDED_OVER) {
            long dur = 0;
            if (p.getReceivedAt() != null && p.getHandedOverAt() != null) {
                dur = Math.max(0, ChronoUnit.MINUTES.between(p.getReceivedAt(), p.getHandedOverAt()));
            }
            boolean under15m = dur < EXPRESS_FAST_MINUTES;
            String tier = under15m ? "EXPRESS_15M" : (dur <= SLA_TARGET_MINUTES ? "ON_TIME" : "DELAYED");
            String label = under15m
                ? "Delivered in " + dur + "m · < 15m Express"
                : "Delivered in " + formatDuration(dur);
            item.put("durationMinutes", dur);
            item.put("elapsedMinutes", dur);
            item.put("remainingMinutes", SLA_TARGET_MINUTES - dur);
            item.put("formattedElapsed", formatDuration(dur));
            item.put("tier", tier);
            item.put("label", label);
            item.put("isUnder15m", under15m);
            item.put("isSlaRisk", false);
            item.put("isOverdue", false);
            return item;
        }

        if (p.getStatus() == ParcelStatus.RESCHEDULED) {
            item.put("durationMinutes", null);
            item.put("elapsedMinutes", 0L);
            item.put("remainingMinutes", (long) SLA_TARGET_MINUTES);
            item.put("formattedElapsed", "Hold");
            item.put("tier", "DEFERRED_HOLD");
            item.put("label", "Deferred Tomorrow Hold");
            item.put("isUnder15m", false);
            item.put("isSlaRisk", false);
            item.put("isOverdue", false);
            return item;
        }

        long elapsed = p.getReceivedAt() != null
            ? Math.max(0, ChronoUnit.MINUTES.between(p.getReceivedAt(), now))
            : 0L;
        long remaining = SLA_TARGET_MINUTES - elapsed;

        String tier;
        String label;
        if (elapsed < EXPRESS_FAST_MINUTES) {
            tier = "EXPRESS_FRESH";
            label = "< 15m Express · " + formatDuration(remaining) + " left";
        } else if (elapsed < SLA_WARNING_MINUTES) {
            tier = "ON_TRACK";
            label = "SLA " + formatDuration(remaining) + " left";
        } else if (elapsed < SLA_TARGET_MINUTES) {
            tier = "SLA_RISK";
            label = "SLA Risk · " + formatDuration(remaining) + " left";
        } else {
            tier = "OVERDUE";
            label = "Pending > 4h (" + formatDuration(elapsed) + ")";
        }

        item.put("durationMinutes", null);
        item.put("elapsedMinutes", elapsed);
        item.put("remainingMinutes", remaining);
        item.put("formattedElapsed", formatDuration(elapsed));
        item.put("tier", tier);
        item.put("label", label);
        item.put("isUnder15m", elapsed < EXPRESS_FAST_MINUTES);
        item.put("isSlaRisk", elapsed >= SLA_WARNING_MINUTES);
        item.put("isOverdue", elapsed >= SLA_TARGET_MINUTES);
        return item;
    }

    public static String formatDuration(long totalMinutes) {
        long abs = Math.abs(totalMinutes);
        if (abs < 60) {
            return abs + "m";
        }
        long hours = abs / 60;
        long mins = abs % 60;
        return mins == 0 ? (hours + "h") : (hours + "h " + mins + "m");
    }

    private String canonicalizeSlot(String raw) {
        if (raw == null || raw.isBlank()) {
            return "Unscheduled";
        }
        String norm = raw.trim().replace('-', '–');
        for (String std : STANDARD_SLOTS) {
            if (std.equalsIgnoreCase(norm)) {
                return std;
            }
        }
        return raw.trim();
    }

    private String shortenSlotLabel(String slot) {
        if ("Unscheduled".equals(slot)) return "Unsched";
        return slot
            .replace(":00", "")
            .replace(" AM", "a")
            .replace(" PM", "p")
            .replace(" – ", "–");
    }

    private static double roundOneDecimal(double val) {
        return Math.round(val * 10.0) / 10.0;
    }

    private static final class DailyBucket {
        final LocalDate date;
        int dispatched = 0;
        int delivered = 0;
        int rescheduled = 0;

        DailyBucket(LocalDate date) {
            this.date = date;
        }

        Map<String, Object> toMap() {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("date", date.toString());
            m.put("label", date.format(DateTimeFormatter.ofPattern("MMM d", Locale.ENGLISH)));
            m.put("dispatched", dispatched);
            m.put("delivered", delivered);
            m.put("rescheduled", rescheduled);
            return m;
        }
    }

    private static final class AgentSpeedAccumulator {
        final Long agentId;
        final String agentName;
        int completedCount = 0;
        long durationSumMinutes = 0;
        int under15MinCount = 0;
        int openSlaRisks = 0;

        AgentSpeedAccumulator(Long agentId, String agentName) {
            this.agentId = agentId;
            this.agentName = agentName;
        }

        Map<String, Object> toMap() {
            Double avgMin = completedCount > 0 ? roundOneDecimal((double) durationSumMinutes / completedCount) : null;
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("agentId", agentId);
            m.put("agentName", agentName);
            m.put("completedCount", completedCount);
            m.put("avgHandoverMinutes", avgMin);
            m.put("under15MinCount", under15MinCount);
            m.put("openSlaRisks", openSlaRisks);
            return m;
        }
    }
}

