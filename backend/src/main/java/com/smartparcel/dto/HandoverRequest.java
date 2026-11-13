package com.smartparcel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

public record HandoverRequest(
    @NotBlank
    @Pattern(regexp = "^[0-9]{6}$", message = "OTP must contain six digits")
    String otp,
    String proofPhotoUrl,
    String proofNote,
    String verificationSource
) {
    public HandoverRequest(String otp) {
        this(otp, null, null, null);
    }
}
