package com.smartparcel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record InstructionRequest(
    @NotBlank @Size(max = 150) String instruction,
    @Size(max = 100) String residentName
) {}

