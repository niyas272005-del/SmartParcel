package com.smartparcel.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "parcel_messages")
public class ParcelMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long parcelId;

    private Long senderId;

    @Column(nullable = false)
    private String senderName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private UserRole senderRole;

    @Column(nullable = false, length = 600)
    private String message;

    private LocalDateTime createdAt;

    public ParcelMessage() {}

    public ParcelMessage(Long parcelId, Long senderId, String senderName, UserRole senderRole, String message) {
        this.parcelId = parcelId;
        this.senderId = senderId;
        this.senderName = senderName;
        this.senderRole = senderRole;
        this.message = message;
        this.createdAt = LocalDateTime.now();
    }

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getParcelId() { return parcelId; }
    public void setParcelId(Long parcelId) { this.parcelId = parcelId; }

    public Long getSenderId() { return senderId; }
    public void setSenderId(Long senderId) { this.senderId = senderId; }

    public String getSenderName() { return senderName; }
    public void setSenderName(String senderName) { this.senderName = senderName; }

    public UserRole getSenderRole() { return senderRole; }
    public void setSenderRole(UserRole senderRole) { this.senderRole = senderRole; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

