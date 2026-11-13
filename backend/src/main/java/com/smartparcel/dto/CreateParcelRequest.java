package com.smartparcel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CreateParcelRequest(
    @NotBlank @Size(max = 80) String trackingNumber,
    @NotBlank @Size(max = 60) String courier,
    @NotBlank @Size(max = 30) String flatNumber,
    @Size(max = 100) String recipientName,
    @Size(max = 25) String recipientPhone,
    @Size(max = 50) String category,
    @Size(max = 250) String description,
    Long agentId,
    @Size(max = 100) String agentName,
    @Size(max = 25) String agentPhone
) {
    public CreateParcelRequest(String trackingNumber, String courier, String flatNumber, String recipientName, String description) {
        this(trackingNumber, courier, flatNumber, recipientName, null, "Box", description, null, null, null);
    }

    public CreateParcelRequest(String trackingNumber, String courier, String flatNumber, String recipientName, String recipientPhone, String category, String description) {
        this(trackingNumber, courier, flatNumber, recipientName, recipientPhone, category, description, null, null, null);
    }
}
