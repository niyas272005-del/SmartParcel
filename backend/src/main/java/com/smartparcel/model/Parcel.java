package com.smartparcel.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "parcels", uniqueConstraints = @UniqueConstraint(columnNames = "trackingNumber"))
public class Parcel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String trackingNumber;

    @Column(nullable = false)
    private String courier;

    @Column(nullable = false)
    private String flatNumber;

    private String recipientName;
    private String recipientPhone;
    private String category;
    private String description;
    private LocalDateTime receivedAt;
    private LocalDateTime handedOverAt;
    private String slot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private ParcelStatus status = ParcelStatus.RECEIVED;

    private String demoOtp;
    private Long agentId;
    private String agentName;
    private String agentPhone;
    private String deliveryInstruction;
    private String preferredDate;
    private String rescheduleReason;
    private Boolean rescheduledOnce = Boolean.FALSE;

    @Lob
    @Column(length = 16777215)
    private String proofPhotoUrl;
    private String proofNote;
    private LocalDateTime proofCapturedAt;
    private String verifiedMethod;
    private String handedOverTo;

    private Boolean delegated = Boolean.FALSE;
    private String delegateFlat;
    private String delegateName;
    private String delegatePhone;
    private String delegateOtp;

    private Boolean issueReported = Boolean.FALSE;
    private String issueCategory;
    @Column(length = 1000)
    private String issueNotes;
    @Lob
    @Column(length = 16777215)
    private String issuePhotoUrl;
    private String issueStatus;
    private LocalDateTime issueReportedAt;
    @Column(length = 1000)
    private String issueResolutionNote;
    private LocalDateTime issueResolvedAt;

    private Integer deliveryRating;
    @Column(length = 250)
    private String ratingTags;
    @Column(length = 500)
    private String ratingComment;
    private LocalDateTime ratedAt;

    private Boolean slaEscalated = Boolean.FALSE;
    private LocalDateTime slaEscalatedAt;

    private Boolean agentScheduleConfirmed = Boolean.FALSE;
    private LocalDateTime agentScheduleConfirmedAt;
    private String agentScheduleConfirmedBy;
    @Column(length = 500)
    private String agentScheduleConfirmMessage;

    // Multi-Parcel Bundling
    private Boolean bundled = Boolean.FALSE;
    private String bundleCode;
    private Integer bundleSize = 1;
    private String masterOtp;

    // Reverse Pickup (Customer Returns)
    private Boolean returnPickup = Boolean.FALSE;
    private String returnReason;
    private String returnOriginalTracking;
    private String returnStatus;
    private String returnOtp;
    private LocalDateTime returnScheduledAt;
    private LocalDateTime returnPickedUpAt;

    public Parcel() {}

    @PrePersist
    void onCreate() {
        if (receivedAt == null) {
            receivedAt = LocalDateTime.now();
        }
        if (status == null) {
            status = ParcelStatus.RECEIVED;
        }
        if (category == null || category.isBlank()) {
            category = "Box";
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getTrackingNumber() { return trackingNumber; }
    public void setTrackingNumber(String v) { this.trackingNumber = v; }

    public String getCourier() { return courier; }
    public void setCourier(String v) { this.courier = v; }

    public String getFlatNumber() { return flatNumber; }
    public void setFlatNumber(String v) { this.flatNumber = v; }

    public String getRecipientName() { return recipientName; }
    public void setRecipientName(String v) { this.recipientName = v; }

    public String getRecipientPhone() { return recipientPhone; }
    public void setRecipientPhone(String v) { this.recipientPhone = v; }

    public String getCategory() { return category; }
    public void setCategory(String v) { this.category = v; }

    public String getDescription() { return description; }
    public void setDescription(String v) { this.description = v; }

    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime v) { this.receivedAt = v; }

    public LocalDateTime getHandedOverAt() { return handedOverAt; }
    public void setHandedOverAt(LocalDateTime v) { this.handedOverAt = v; }

    public String getSlot() { return slot; }
    public void setSlot(String v) { this.slot = v; }

    public ParcelStatus getStatus() { return status; }
    public void setStatus(ParcelStatus v) { this.status = v; }

    public String getDemoOtp() { return demoOtp; }
    public void setDemoOtp(String v) { this.demoOtp = v; }

    public Long getAgentId() { return agentId; }
    public void setAgentId(Long v) { this.agentId = v; }

    public String getAgentName() { return agentName; }
    public void setAgentName(String v) { this.agentName = v; }

    public String getAgentPhone() { return agentPhone; }
    public void setAgentPhone(String v) { this.agentPhone = v; }

    public String getDeliveryInstruction() { return deliveryInstruction; }
    public void setDeliveryInstruction(String v) { this.deliveryInstruction = v; }

    public String getPreferredDate() { return preferredDate; }
    public void setPreferredDate(String v) { this.preferredDate = v; }

    public String getRescheduleReason() { return rescheduleReason; }
    public void setRescheduleReason(String v) { this.rescheduleReason = v; }

    public boolean isRescheduledOnce() {
        return Boolean.TRUE.equals(rescheduledOnce) || status == ParcelStatus.RESCHEDULED;
    }
    public void setRescheduledOnce(Boolean v) { this.rescheduledOnce = v; }

    public String getProofPhotoUrl() { return proofPhotoUrl; }
    public void setProofPhotoUrl(String v) { this.proofPhotoUrl = v; }

    public String getProofNote() { return proofNote; }
    public void setProofNote(String v) { this.proofNote = v; }

    public LocalDateTime getProofCapturedAt() { return proofCapturedAt; }
    public void setProofCapturedAt(LocalDateTime v) { this.proofCapturedAt = v; }

    public String getVerifiedMethod() { return verifiedMethod; }
    public void setVerifiedMethod(String v) { this.verifiedMethod = v; }

    public String getHandedOverTo() { return handedOverTo; }
    public void setHandedOverTo(String v) { this.handedOverTo = v; }

    public boolean isDelegated() { return Boolean.TRUE.equals(delegated); }
    public void setDelegated(Boolean v) { this.delegated = v; }

    public String getDelegateFlat() { return delegateFlat; }
    public void setDelegateFlat(String v) { this.delegateFlat = v; }

    public String getDelegateName() { return delegateName; }
    public void setDelegateName(String v) { this.delegateName = v; }

    public String getDelegatePhone() { return delegatePhone; }
    public void setDelegatePhone(String v) { this.delegatePhone = v; }

    public String getDelegateOtp() { return delegateOtp; }
    public void setDelegateOtp(String v) { this.delegateOtp = v; }

    public boolean isIssueReported() { return Boolean.TRUE.equals(issueReported); }
    public void setIssueReported(Boolean v) { this.issueReported = v; }

    public String getIssueCategory() { return issueCategory; }
    public void setIssueCategory(String v) { this.issueCategory = v; }

    public String getIssueNotes() { return issueNotes; }
    public void setIssueNotes(String v) { this.issueNotes = v; }

    public String getIssuePhotoUrl() { return issuePhotoUrl; }
    public void setIssuePhotoUrl(String v) { this.issuePhotoUrl = v; }

    public String getIssueStatus() { return issueStatus; }
    public void setIssueStatus(String v) { this.issueStatus = v; }

    public LocalDateTime getIssueReportedAt() { return issueReportedAt; }
    public void setIssueReportedAt(LocalDateTime v) { this.issueReportedAt = v; }

    public String getIssueResolutionNote() { return issueResolutionNote; }
    public void setIssueResolutionNote(String v) { this.issueResolutionNote = v; }

    public LocalDateTime getIssueResolvedAt() { return issueResolvedAt; }
    public void setIssueResolvedAt(LocalDateTime v) { this.issueResolvedAt = v; }

    public Integer getDeliveryRating() { return deliveryRating; }
    public void setDeliveryRating(Integer v) { this.deliveryRating = v; }

    public String getRatingTags() { return ratingTags; }
    public void setRatingTags(String v) { this.ratingTags = v; }

    public String getRatingComment() { return ratingComment; }
    public void setRatingComment(String v) { this.ratingComment = v; }

    public LocalDateTime getRatedAt() { return ratedAt; }
    public void setRatedAt(LocalDateTime v) { this.ratedAt = v; }

    public boolean isSlaEscalated() { return Boolean.TRUE.equals(slaEscalated); }
    public void setSlaEscalated(Boolean v) { this.slaEscalated = v; }

    public LocalDateTime getSlaEscalatedAt() { return slaEscalatedAt; }
    public void setSlaEscalatedAt(LocalDateTime v) { this.slaEscalatedAt = v; }

    public boolean isAgentScheduleConfirmed() { return Boolean.TRUE.equals(agentScheduleConfirmed); }
    public void setAgentScheduleConfirmed(Boolean v) { this.agentScheduleConfirmed = v; }

    public LocalDateTime getAgentScheduleConfirmedAt() { return agentScheduleConfirmedAt; }
    public void setAgentScheduleConfirmedAt(LocalDateTime v) { this.agentScheduleConfirmedAt = v; }

    public String getAgentScheduleConfirmedBy() { return agentScheduleConfirmedBy; }
    public void setAgentScheduleConfirmedBy(String v) { this.agentScheduleConfirmedBy = v; }

    public String getAgentScheduleConfirmMessage() { return agentScheduleConfirmMessage; }
    public void setAgentScheduleConfirmMessage(String v) { this.agentScheduleConfirmMessage = v; }

    // Bundling Getters & Setters
    public boolean isBundled() { return Boolean.TRUE.equals(bundled); }
    public void setBundled(Boolean v) { this.bundled = v; }

    public String getBundleCode() { return bundleCode; }
    public void setBundleCode(String v) { this.bundleCode = v; }

    public Integer getBundleSize() { return bundleSize != null ? bundleSize : 1; }
    public void setBundleSize(Integer v) { this.bundleSize = v; }

    public String getMasterOtp() { return masterOtp; }
    public void setMasterOtp(String v) { this.masterOtp = v; }

    // Reverse Pickup Getters & Setters
    public boolean isReturnPickup() { return Boolean.TRUE.equals(returnPickup); }
    public void setReturnPickup(Boolean v) { this.returnPickup = v; }

    public String getReturnReason() { return returnReason; }
    public void setReturnReason(String v) { this.returnReason = v; }

    public String getReturnOriginalTracking() { return returnOriginalTracking; }
    public void setReturnOriginalTracking(String v) { this.returnOriginalTracking = v; }

    public String getReturnStatus() { return returnStatus; }
    public void setReturnStatus(String v) { this.returnStatus = v; }

    public String getReturnOtp() { return returnOtp; }
    public void setReturnOtp(String v) { this.returnOtp = v; }

    public LocalDateTime getReturnScheduledAt() { return returnScheduledAt; }
    public void setReturnScheduledAt(LocalDateTime v) { this.returnScheduledAt = v; }

    public LocalDateTime getReturnPickedUpAt() { return returnPickedUpAt; }
    public void setReturnPickedUpAt(LocalDateTime v) { this.returnPickedUpAt = v; }
}
