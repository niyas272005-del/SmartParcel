package com.smartparcel.dto;

import jakarta.validation.constraints.Size;

public record UserPreferencesRequest(
    @Size(max = 160) String defaultInstruction,
    @Size(max = 50) String defaultSlot,
    Boolean quietHoursEnabled,
    @Size(max = 20) String quietHoursStart,
    @Size(max = 20) String quietHoursEnd,
    Boolean vacationMode,
    @Size(max = 30) String vacationFrom,
    @Size(max = 30) String vacationUntil
) {}

