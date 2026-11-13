package com.smartparcel.controller;

import com.smartparcel.dto.AuthResponse;
import com.smartparcel.dto.LoginRequest;
import com.smartparcel.dto.RegisterRequest;
import com.smartparcel.dto.UserPreferencesRequest;
import com.smartparcel.model.User;
import com.smartparcel.model.UserRole;
import com.smartparcel.repository.UserRepository;
import com.smartparcel.service.ResidentPreferencesService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final UserRepository userRepository;
    private final ResidentPreferencesService preferencesService;

    public AuthController(UserRepository userRepository, ResidentPreferencesService preferencesService) {
        this.userRepository = userRepository;
        this.preferencesService = preferencesService;
    }

    @PostMapping("/register")
    public AuthResponse register(@Valid @RequestBody RegisterRequest req) {
        String email = req.email().trim().toLowerCase();
        if (userRepository.existsByEmail(email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "An account with this email already exists");
        }

        User user = new User();
        user.setName(req.name().trim());
        user.setEmail(email);
        user.setPassword(req.password()); // In production, hash with BCrypt
        user.setPhone(req.phone() != null ? req.phone().trim() : null);
        user.setFlatNumber(req.flatNumber() != null ? req.flatNumber().trim().toUpperCase() : null);
        user.setRole(req.role() != null ? req.role() : UserRole.ROLE_RESIDENT);
        user.setActive(true);

        User saved = userRepository.save(user);
        String token = "TOKEN-" + UUID.randomUUID();

        return new AuthResponse(token, saved, "Account created successfully! Welcome to SmartParcel.");
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        String email = req.email().trim().toLowerCase();
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password"));

        if (!user.getPassword().equals(req.password())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid email or password");
        }

        if (!user.isActive()) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Your account has been deactivated by administration.");
        }

        String token = "TOKEN-" + UUID.randomUUID();
        return new AuthResponse(token, user, "Welcome back, " + user.getName() + "!");
    }

    @GetMapping("/users")
    public List<User> listUsers() {
        return userRepository.findAll();
    }

    @GetMapping("/neighbors")
    public List<Map<String, Object>> listTrustedNeighbors(@RequestParam(required = false) String excludeFlat) {
        String skip = excludeFlat != null ? excludeFlat.trim().toUpperCase() : "";
        return userRepository.findByRole(UserRole.ROLE_RESIDENT).stream()
            .filter(User::isActive)
            .filter(u -> u.getFlatNumber() != null && !u.getFlatNumber().isBlank())
            .filter(u -> skip.isEmpty() || !skip.equalsIgnoreCase(u.getFlatNumber().trim()))
            .sorted((a, b) -> a.getFlatNumber().compareToIgnoreCase(b.getFlatNumber()))
            .map(u -> {
                Map<String, Object> item = new java.util.LinkedHashMap<>();
                item.put("id", u.getId());
                item.put("name", u.getName());
                item.put("flatNumber", u.getFlatNumber());
                item.put("phone", u.getPhone() != null ? u.getPhone() : "");
                return item;
            })
            .toList();
    }

    @PatchMapping("/users/{id}/toggle-active")
    public Map<String, Object> toggleActive(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        user.setActive(!user.isActive());
        userRepository.save(user);
        return Map.of("message", "User status updated", "active", user.isActive(), "userId", id);
    }

    @DeleteMapping("/users/{id}")
    public Map<String, Object> deleteUser(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        userRepository.delete(user);
        return Map.of("message", "User deleted successfully", "userId", id);
    }

    @GetMapping("/users/{id}/preferences")
    public Map<String, Object> getUserPreferences(@PathVariable Long id) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
        return preferencesService.toPreferencePayload(user, LocalDate.now());
    }

    @PutMapping("/users/{id}/preferences")
    public Map<String, Object> updateUserPreferences(
            @PathVariable Long id,
            @Valid @RequestBody UserPreferencesRequest req) {
        User user = userRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));

        LocalDate from = preferencesService.parseIsoDate(req.vacationFrom());
        LocalDate until = preferencesService.parseIsoDate(req.vacationUntil());
        if (req.vacationFrom() != null && !req.vacationFrom().isBlank() && from == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid vacation start date (use YYYY-MM-DD)");
        }
        if (req.vacationUntil() != null && !req.vacationUntil().isBlank() && until == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid vacation end date (use YYYY-MM-DD)");
        }
        if (from != null && until != null && until.isBefore(from)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vacation end date must be on or after start date");
        }

        user.setDefaultInstruction(preferencesService.trimToNull(req.defaultInstruction()));
        user.setDefaultSlot(preferencesService.trimToNull(req.defaultSlot()));
        user.setQuietHoursEnabled(Boolean.TRUE.equals(req.quietHoursEnabled()));
        user.setQuietHoursStart(preferencesService.trimToNull(req.quietHoursStart()));
        user.setQuietHoursEnd(preferencesService.trimToNull(req.quietHoursEnd()));
        user.setVacationMode(Boolean.TRUE.equals(req.vacationMode()));
        user.setVacationFrom(from != null ? from.toString() : null);
        user.setVacationUntil(until != null ? until.toString() : null);

        User saved = userRepository.save(user);
        Map<String, Object> res = new LinkedHashMap<>();
        res.put("message", saved.isVacationMode()
            ? "Doorstep rules & Vacation Mode saved successfully"
            : "Doorstep delivery preferences saved successfully");
        res.put("user", saved);
        res.put("preferences", preferencesService.toPreferencePayload(saved, LocalDate.now()));
        return res;
    }

    @GetMapping("/flat-preferences")
    public Map<String, Object> getFlatPreferences(@RequestParam String flatNumber) {
        if (flatNumber == null || flatNumber.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "flatNumber is required");
        }
        String flat = flatNumber.trim().toUpperCase();
        LocalDate today = LocalDate.now();
        return preferencesService.resolveFlatPreferenceOwner(userRepository.findByFlatNumber(flat), today)
            .map(owner -> preferencesService.toPreferencePayload(owner, today))
            .orElseGet(() -> {
                Map<String, Object> empty = new LinkedHashMap<>();
                empty.put("flatNumber", flat);
                empty.put("vacationMode", false);
                empty.put("vacationActiveToday", false);
                empty.put("hasPreferences", false);
                return empty;
            });
    }
}

