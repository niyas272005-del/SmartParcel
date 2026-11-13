package com.smartparcel.dto;

import com.smartparcel.model.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record SendMessageRequest(
    Long senderId,
    @NotBlank @Size(max = 100) String senderName,
    UserRole senderRole,
    @NotBlank @Size(max = 600) String message
) {}

