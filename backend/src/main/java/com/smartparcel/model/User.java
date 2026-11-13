package com.smartparcel.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "users")
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    @JsonIgnore
    private String password;

    private String phone;

    private String flatNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private UserRole role = UserRole.ROLE_RESIDENT;

    private boolean active = true;

    private String defaultInstruction;
    private String defaultSlot;
    private Boolean quietHoursEnabled = Boolean.FALSE;
    private String quietHoursStart;
    private String quietHoursEnd;
    private Boolean vacationMode = Boolean.FALSE;
    private String vacationFrom;
    private String vacationUntil;

    private LocalDateTime createdAt;

    public User() {}

    @PrePersist
    void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getEmail() { return email; }
    public void setEmail(String email) { this.email = email; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getPhone() { return phone; }
    public void setPhone(String phone) { this.phone = phone; }

    public String getFlatNumber() { return flatNumber; }
    public void setFlatNumber(String flatNumber) { this.flatNumber = flatNumber; }

    public UserRole getRole() { return role; }
    public void setRole(UserRole role) { this.role = role; }

    public boolean isActive() { return active; }
    public void setActive(boolean active) { this.active = active; }

    public String getDefaultInstruction() { return defaultInstruction; }
    public void setDefaultInstruction(String defaultInstruction) { this.defaultInstruction = defaultInstruction; }

    public String getDefaultSlot() { return defaultSlot; }
    public void setDefaultSlot(String defaultSlot) { this.defaultSlot = defaultSlot; }

    public boolean isQuietHoursEnabled() { return Boolean.TRUE.equals(quietHoursEnabled); }
    public void setQuietHoursEnabled(Boolean quietHoursEnabled) { this.quietHoursEnabled = quietHoursEnabled; }

    public String getQuietHoursStart() { return quietHoursStart; }
    public void setQuietHoursStart(String quietHoursStart) { this.quietHoursStart = quietHoursStart; }

    public String getQuietHoursEnd() { return quietHoursEnd; }
    public void setQuietHoursEnd(String quietHoursEnd) { this.quietHoursEnd = quietHoursEnd; }

    public boolean isVacationMode() { return Boolean.TRUE.equals(vacationMode); }
    public void setVacationMode(Boolean vacationMode) { this.vacationMode = vacationMode; }

    public String getVacationFrom() { return vacationFrom; }
    public void setVacationFrom(String vacationFrom) { this.vacationFrom = vacationFrom; }

    public String getVacationUntil() { return vacationUntil; }
    public void setVacationUntil(String vacationUntil) { this.vacationUntil = vacationUntil; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}

