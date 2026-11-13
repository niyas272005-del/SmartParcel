package com.smartparcel.dto;

import jakarta.validation.constraints.NotBlank;

public record DelegateRequest(
    @NotBlank(message = "Delegate flat number is required")
    String delegateFlat,

    @NotBlank(message = "Delegate name is required")
    String delegateName,

    String delegatePhone,

    String note
) {}

