package com.smartparcel.dto;

public record ReturnPickupRequest(
    String courier,
    String flatNumber,
    String recipientName,
    String recipientPhone,
    String returnReason,
    String originalTrackingNumber,
    String slot,
    String preferredDate,
    String deliveryInstruction
) {}

