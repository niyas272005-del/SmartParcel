package com.smartparcel.dto;

import java.util.List;

public record BundleSlotRequest(
    String flatNumber,
    List<Long> parcelIds,
    String slot,
    String preferredDate,
    String deliveryInstruction
) {}

