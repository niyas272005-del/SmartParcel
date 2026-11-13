package com.smartparcel.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ReportIssueRequest(
    @NotBlank(message = "Issue category is required")
    @Size(max = 80)
    String category,

    @NotBlank(message = "Please describe the delivery issue")
    @Size(max = 1000)
    String notes,

    String photoUrl,

    @Size(max = 100)
    String reportedBy
) {}

