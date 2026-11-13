package com.smartparcel.service;

import com.smartparcel.model.Parcel;
import com.smartparcel.model.ParcelStatus;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class RouteBatchingService {

    private static final Pattern ALPHANUM_FLAT = Pattern.compile("^([A-Z]+)\\s*(\\d+.*)$");
    private static final Pattern FIRST_NUMBER = Pattern.compile("(\\d+)");

    public record FlatLocation(String normalizedFlat, String tower, int floor, int doorNumber) {}

    public FlatLocation parseFlatLocation(String rawFlat) {
        String normalized = (rawFlat == null || rawFlat.isBlank())
            ? "UNASSIGNED"
            : rawFlat.trim().toUpperCase(Locale.ROOT);

        String tower;
        String unitPart;
        int dashIdx = normalized.indexOf('-');
        if (dashIdx > 0 && dashIdx < normalized.length() - 1) {
            tower = normalized.substring(0, dashIdx).trim();
            unitPart = normalized.substring(dashIdx + 1).trim();
        } else {
            Matcher m = ALPHANUM_FLAT.matcher(normalized);
            if (m.matches()) {
                tower = m.group(1);
                unitPart = m.group(2);
            } else {
                tower = "MAIN";
                unitPart = normalized;
            }
        }

        int door = 0;
        Matcher numMatch = FIRST_NUMBER.matcher(unitPart);
        if (numMatch.find()) {
            try {
                door = Integer.parseInt(numMatch.group(1));
            } catch (NumberFormatException ignored) {
                door = 0;
            }
        }
        int floor = door >= 100 ? door / 100 : 0;
        return new FlatLocation(normalized, tower, floor, door);
    }

    public String getEffectiveDeliveryFlat(Parcel p) {
        if (p.isDelegated() && p.getDelegateFlat() != null && !p.getDelegateFlat().isBlank()) {
            return p.getDelegateFlat().trim().toUpperCase(Locale.ROOT);
        }
        return p.getFlatNumber() != null ? p.getFlatNumber().trim().toUpperCase(Locale.ROOT) : "UNASSIGNED";
    }

    public List<Parcel> sortParcelsForAgentRoute(List<Parcel> parcels) {
        List<Parcel> copy = new ArrayList<>(parcels);
        copy.sort(this::compareForRoute);
        return copy;
    }

    private int compareForRoute(Parcel a, Parcel b) {
        int groupA = statusPriority(a.getStatus());
        int groupB = statusPriority(b.getStatus());
        if (groupA != groupB) {
            return Integer.compare(groupA, groupB);
        }

        FlatLocation locA = parseFlatLocation(getEffectiveDeliveryFlat(a));
        FlatLocation locB = parseFlatLocation(getEffectiveDeliveryFlat(b));

        int towerCmp = compareStringsNatural(locA.tower(), locB.tower());
        if (towerCmp != 0) return towerCmp;

        int floorCmp = Integer.compare(locA.floor(), locB.floor());
        if (floorCmp != 0) return floorCmp;

        int doorCmp = Integer.compare(locA.doorNumber(), locB.doorNumber());
        if (doorCmp != 0) return doorCmp;

        int flatCmp = locA.normalizedFlat().compareToIgnoreCase(locB.normalizedFlat());
        if (flatCmp != 0) return flatCmp;

        return Long.compare(a.getId() != null ? a.getId() : 0L, b.getId() != null ? b.getId() : 0L);
    }

    private int statusPriority(ParcelStatus status) {
        if (status == ParcelStatus.HANDED_OVER) return 2;
        if (status == ParcelStatus.RESCHEDULED) return 1;
        return 0; // RECEIVED / SLOT_BOOKED deliverable today
    }

    private int compareStringsNatural(String a, String b) {
        if (a.equals(b)) return 0;
        if ("MAIN".equals(a)) return 1;
        if ("MAIN".equals(b)) return -1;
        return a.compareToIgnoreCase(b);
    }

    public Map<String, Object> buildRouteQueuePayload(List<Parcel> allParcels, String residentFlatFilter) {
        String resFlat = (residentFlatFilter != null && !residentFlatFilter.isBlank())
            ? residentFlatFilter.trim().toUpperCase(Locale.ROOT)
            : null;
        boolean residentOnly = resFlat != null;

        List<Parcel> sortedDeliverable = allParcels.stream()
            .filter(p -> p.getStatus() == ParcelStatus.RECEIVED || p.getStatus() == ParcelStatus.SLOT_BOOKED)
            .sorted(this::compareForRoute)
            .toList();

        long totalHolds = allParcels.stream()
            .filter(p -> p.getStatus() == ParcelStatus.RESCHEDULED)
            .count();

        // Group sorted parcels into physical stops by effectiveFlat
        Map<String, List<Parcel>> stopGroups = new LinkedHashMap<>();
        for (Parcel p : sortedDeliverable) {
            stopGroups.computeIfAbsent(getEffectiveDeliveryFlat(p), k -> new ArrayList<>()).add(p);
        }

        int totalStops = stopGroups.size();
        int totalActiveDrops = sortedDeliverable.size();

        List<Map<String, Object>> routeStops = new ArrayList<>();
        Map<Long, Map<String, Object>> dropsByParcelId = new LinkedHashMap<>();
        Map<String, Integer> towerDropCounts = new LinkedHashMap<>();
        Map<String, Set<String>> towerFlats = new LinkedHashMap<>();

        int stopNumber = 0;
        int priorParcelCount = 0;

        String currentServingFlat = !stopGroups.isEmpty() ? stopGroups.keySet().iterator().next() : null;
        FlatLocation currentServingLoc = currentServingFlat != null ? parseFlatLocation(currentServingFlat) : null;

        for (Map.Entry<String, List<Parcel>> entry : stopGroups.entrySet()) {
            stopNumber++;
            String effFlat = entry.getKey();
            List<Parcel> stopParcels = entry.getValue();
            FlatLocation loc = parseFlatLocation(effFlat);

            towerDropCounts.merge(loc.tower(), stopParcels.size(), Integer::sum);
            towerFlats.computeIfAbsent(loc.tower(), k -> new LinkedHashSet<>()).add(effFlat);

            int dropsAhead = priorParcelCount;
            int stopsAhead = stopNumber - 1;
            int batchSize = stopParcels.size();

            int etaMinutes;
            String etaLabel;
            String doorstepNudge;
            if (dropsAhead <= 0) {
                etaMinutes = 2;
                etaLabel = "~2 mins";
                doorstepNudge = "Reaching Your Door in ~1–2 Mins! Please keep Digital Pass QR ready.";
            } else if (dropsAhead == 1) {
                etaMinutes = 3;
                etaLabel = "~3 mins";
                doorstepNudge = "1 drop ahead (~2–3 mins) · Agent on Floor " + (currentServingLoc != null ? currentServingLoc.floor() : loc.floor());
            } else {
                etaMinutes = Math.min(60, dropsAhead * 3);
                etaLabel = "~" + etaMinutes + " mins";
                doorstepNudge = dropsAhead + " drops away (" + etaLabel + ") · Serving " + (currentServingFlat != null ? currentServingFlat : "earlier flats");
            }

            if (!residentOnly) {
                Map<String, Object> stopCard = new LinkedHashMap<>();
                stopCard.put("stopNumber", stopNumber);
                stopCard.put("effectiveFlat", effFlat);
                stopCard.put("tower", loc.tower());
                stopCard.put("floor", loc.floor());
                stopCard.put("doorNumber", loc.doorNumber());
                stopCard.put("parcelCount", batchSize);
                stopCard.put("dropsAhead", dropsAhead);
                stopCard.put("etaMinutes", etaMinutes);
                stopCard.put("etaLabel", etaLabel);
                stopCard.put("parcelIds", stopParcels.stream().map(Parcel::getId).toList());
                stopCard.put("trackingNumbers", stopParcels.stream().map(Parcel::getTrackingNumber).toList());
                stopCard.put("delegated", stopParcels.stream().anyMatch(Parcel::isDelegated));
                stopCard.put("hasReturnPickup", stopParcels.stream().anyMatch(Parcel::isReturnPickup));
                stopCard.put("hasBundled", stopParcels.stream().anyMatch(Parcel::isBundled));
                routeStops.add(stopCard);
            }

            for (Parcel p : stopParcels) {
                boolean visibleToCaller = !residentOnly || isFlatAuthorizedForParcel(p, resFlat);
                if (visibleToCaller) {
                    Map<String, Object> meta = new LinkedHashMap<>();
                    meta.put("parcelId", p.getId());
                    meta.put("stopNumber", stopNumber);
                    meta.put("totalStops", totalStops);
                    meta.put("totalActiveDrops", totalActiveDrops);
                    meta.put("dropsAhead", dropsAhead);
                    meta.put("stopsAhead", stopsAhead);
                    meta.put("batchSize", batchSize);
                    meta.put("effectiveFlat", effFlat);
                    meta.put("tower", loc.tower());
                    meta.put("floor", loc.floor());
                    meta.put("doorNumber", loc.doorNumber());
                    meta.put("etaMinutes", etaMinutes);
                    meta.put("etaLabel", etaLabel);
                    meta.put("isDoorstepNow", dropsAhead == 0);
                    meta.put("isNearby", dropsAhead <= 2);
                    meta.put("doorstepNudge", doorstepNudge);
                    meta.put("currentServingFlat", currentServingFlat);
                    meta.put("currentServingFloor", currentServingLoc != null ? currentServingLoc.floor() : loc.floor());
                    meta.put("currentServingTower", currentServingLoc != null ? currentServingLoc.tower() : loc.tower());
                    meta.put("isReturnPickup", p.isReturnPickup());
                    meta.put("isBundled", p.isBundled());
                    meta.put("bundleCode", p.getBundleCode());
                    meta.put("queueMessage", formatQueueMessage(effFlat, dropsAhead, stopNumber, totalStops));
                    dropsByParcelId.put(p.getId(), meta);
                }
            }

            priorParcelCount += stopParcels.size();
        }

        List<Map<String, Object>> towerBatches = new ArrayList<>();
        for (Map.Entry<String, Integer> t : towerDropCounts.entrySet()) {
            Map<String, Object> tb = new LinkedHashMap<>();
            tb.put("tower", t.getKey());
            tb.put("drops", t.getValue());
            tb.put("stops", towerFlats.getOrDefault(t.getKey(), Set.of()).size());
            towerBatches.add(tb);
        }

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("totalActiveDrops", totalActiveDrops);
        payload.put("totalStops", totalStops);
        payload.put("totalHolds", totalHolds);
        payload.put("towerBatches", towerBatches);
        payload.put("dropsByParcelId", dropsByParcelId);
        if (!residentOnly) {
            payload.put("routeStops", routeStops);
            payload.put("orderedParcelIds", sortedDeliverable.stream().map(Parcel::getId).toList());
        }
        return payload;
    }

    private boolean isFlatAuthorizedForParcel(Parcel p, String resFlat) {
        if (p.getFlatNumber() != null && p.getFlatNumber().trim().equalsIgnoreCase(resFlat)) {
            return true;
        }
        return p.isDelegated() && p.getDelegateFlat() != null && p.getDelegateFlat().trim().equalsIgnoreCase(resFlat);
    }

    private String formatQueueMessage(String flat, int dropsAhead, int stopNumber, int totalStops) {
        if (dropsAhead <= 0) {
            return "Next up for Flat " + flat + " (Stop #1 of " + totalStops + ")";
        }
        String dropWord = dropsAhead == 1 ? "drop" : "drops";
        return dropsAhead + " " + dropWord + " ahead of Flat " + flat;
    }
}

