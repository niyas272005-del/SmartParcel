package com.smartparcel.dto;

import jakarta.validation.constraints.Size;

public record ResolveIssueRequest(
    @Size(max = 40) String status,
    @Size(max = 1000) String resolutionNote,
    @Size(max = 100) String resolvedBy
) {}

