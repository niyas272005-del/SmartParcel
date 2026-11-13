package com.smartparcel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record RescheduleRequest(
    @NotBlank @Size(max = 30) String preferredDate,
    @NotBlank
    @Pattern(regexp = "8:00 AM [–-] 10:00 AM|10:00 AM [–-] 12:00 PM|1:00 PM [–-] 3:00 PM|4:00 PM [–-] 6:00 PM|7:00 PM [–-] 9:00 PM", message = "Choose a listed delivery window")
    String slot,
    @Size(max = 200) String reason
) {}

