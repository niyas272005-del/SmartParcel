package com.smartparcel.dto;

public record BundleHandoverRequest(
    String bundleCode,
    String otp,
    String proofPhotoUrl,
    String proofNote,
    String verifiedMethod,
    String agentName
) {}

