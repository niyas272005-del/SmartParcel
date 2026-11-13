package com.smartparcel.dto;

import com.smartparcel.model.User;

public record AuthResponse(
    String token,
    User user,
    String message
) {}

