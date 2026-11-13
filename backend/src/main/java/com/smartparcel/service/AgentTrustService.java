package com.smartparcel.service;

import com.smartparcel.model.Parcel;
import com.smartparcel.model.ParcelStatus;
import com.smartparcel.model.User;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AgentTrustService {

    public Map<String, Object> buildAgentTrustSummary(List<Parcel> allParcels, List<User> agents) {
        User fallbackAgent = (agents != null && !agents.isEmpty())
            ? agents.stream().filter(User::isActive).findFirst().orElse(agents.get(0))
            : null;
        Long fallbackId = fallbackAgent != null ? fallbackAgent.getId() : null;

        Map<Long, AgentAccumulator> accumulators = new LinkedHashMap<>();
        if (agents != null) {
            for (User agent : agents) {
                accumulators.put(agent.getId(), new AgentAccumulator(agent.getId(), agent.getName()));
            }
        }

        int totalRatings = 0;
        long sumRatings = 0;
        int totalFiveStars = 0;
        int totalCompleted = 0;
        int totalIssues = 0;
        int totalOpenIssues = 0;

        if (allParcels != null) {
            for (Parcel p : allParcels) {
                Long ownerId = p.getAgentId() != null ? p.getAgentId() : fallbackId;
                String ownerName = p.getAgentName() != null && !p.getAgentName().isBlank()
                    ? p.getAgentName()
                    : (fallbackAgent != null ? fallbackAgent.getName() : "Delivery Partner");

                if (ownerId != null) {
                    AgentAccumulator acc = accumulators.computeIfAbsent(
                        ownerId,
                        id -> new AgentAccumulator(id, ownerName)
                    );
                    acc.recordParcel(p);
                }

                if (p.getStatus() == ParcelStatus.HANDED_OVER) {
                    totalCompleted++;
                }
                if (p.isIssueReported()) {
                    totalIssues++;
                    if (!"RESOLVED".equalsIgnoreCase(p.getIssueStatus())) {
                        totalOpenIssues++;
                    }
                }
                if (p.getDeliveryRating() != null) {
                    totalRatings++;
                    sumRatings += p.getDeliveryRating();
                    if (p.getDeliveryRating() >= 5) {
                        totalFiveStars++;
                    }
                }
            }
        }

        Map<String, Map<String, Object>> byAgentId = new LinkedHashMap<>();
        List<Map<String, Object>> agentList = new ArrayList<>();
        for (AgentAccumulator acc : accumulators.values()) {
            Map<String, Object> payload = acc.toMap();
            byAgentId.put(String.valueOf(acc.agentId), payload);
            agentList.add(payload);
        }

        agentList.sort((a, b) -> {
            Double ra = (Double) a.get("averageRating");
            Double rb = (Double) b.get("averageRating");
            if (ra == null && rb == null) {
                return Integer.compare((Integer) b.get("completedDeliveries"), (Integer) a.get("completedDeliveries"));
            }
            if (ra == null) return 1;
            if (rb == null) return -1;
            int cmp = Double.compare(rb, ra);
            if (cmp != 0) return cmp;
            return Integer.compare((Integer) b.get("ratingCount"), (Integer) a.get("ratingCount"));
        });

        Map<String, Object> overall = new LinkedHashMap<>();
        overall.put("averageRating", totalRatings > 0 ? roundOneDecimal((double) sumRatings / totalRatings) : null);
        overall.put("ratingCount", totalRatings);
        overall.put("fiveStarCount", totalFiveStars);
        overall.put("completedDeliveries", totalCompleted);
        overall.put("totalIssues", totalIssues);
        overall.put("openIssues", totalOpenIssues);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("byAgentId", byAgentId);
        result.put("agents", agentList);
        result.put("overall", overall);
        return result;
    }

    private static double roundOneDecimal(double val) {
        return Math.round(val * 10.0) / 10.0;
    }

    private static final class AgentAccumulator {
        final Long agentId;
        final String agentName;
        int completedDeliveries = 0;
        int ratingCount = 0;
        long ratingSum = 0;
        int fiveStarCount = 0;
        int totalIssues = 0;
        int openIssues = 0;
        int resolvedIssues = 0;
        final Map<String, Integer> tagCounts = new HashMap<>();

        AgentAccumulator(Long agentId, String agentName) {
            this.agentId = agentId;
            this.agentName = agentName;
        }

        void recordParcel(Parcel p) {
            if (p.getStatus() == ParcelStatus.HANDED_OVER) {
                completedDeliveries++;
            }
            if (p.isIssueReported()) {
                totalIssues++;
                if ("RESOLVED".equalsIgnoreCase(p.getIssueStatus())) {
                    resolvedIssues++;
                } else {
                    openIssues++;
                }
            }
            if (p.getDeliveryRating() != null) {
                ratingCount++;
                ratingSum += p.getDeliveryRating();
                if (p.getDeliveryRating() >= 5) {
                    fiveStarCount++;
                }
                if (p.getRatingTags() != null && !p.getRatingTags().isBlank()) {
                    for (String rawTag : p.getRatingTags().split(",")) {
                        String tag = rawTag.trim();
                        if (!tag.isEmpty()) {
                            tagCounts.merge(tag, 1, Integer::sum);
                        }
                    }
                }
            }
        }

        Map<String, Object> toMap() {
            Double avg = ratingCount > 0 ? roundOneDecimal((double) ratingSum / ratingCount) : null;
            List<Map<String, Object>> topTags = tagCounts.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue(Comparator.reverseOrder())
                    .thenComparing(Map.Entry.comparingByKey()))
                .limit(5)
                .map(e -> {
                    Map<String, Object> item = new LinkedHashMap<>();
                    item.put("tag", e.getKey());
                    item.put("count", e.getValue());
                    return item;
                })
                .toList();

            String badge;
            if (ratingCount == 0) {
                badge = "Verified Partner";
            } else if (avg >= 4.7 && openIssues == 0) {
                badge = "Top Rated Partner";
            } else if (avg >= 4.0) {
                badge = "Trusted Partner";
            } else {
                badge = "Needs Review";
            }

            Map<String, Object> map = new LinkedHashMap<>();
            map.put("agentId", agentId);
            map.put("agentName", agentName);
            map.put("averageRating", avg);
            map.put("ratingCount", ratingCount);
            map.put("fiveStarCount", fiveStarCount);
            map.put("completedDeliveries", completedDeliveries);
            map.put("totalIssues", totalIssues);
            map.put("openIssues", openIssues);
            map.put("resolvedIssues", resolvedIssues);
            map.put("topTags", topTags);
            map.put("trustBadge", badge);
            return map;
        }
    }
}

