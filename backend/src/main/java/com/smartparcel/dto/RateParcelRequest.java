package com.smartparcel.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

public record RateParcelRequest(
    @NotNull(message = "Star rating is required")
    @Min(value = 1, message = "Rating must be between 1 and 5")
    @Max(value = 5, message = "Rating must be between 1 and 5")
    Integer rating,

    List<String> tags,

    @Size(max = 500)
    String comment
) {}

