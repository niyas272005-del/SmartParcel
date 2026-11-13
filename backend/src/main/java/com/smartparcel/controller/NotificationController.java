package com.smartparcel.controller;

import com.smartparcel.model.Notification;
import com.smartparcel.repository.NotificationRepository;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/notifications")
public class NotificationController {

    private final NotificationRepository notificationRepository;

    public NotificationController(NotificationRepository notificationRepository) {
        this.notificationRepository = notificationRepository;
    }

    @GetMapping
    public List<Notification> getNotifications(@RequestParam Long userId) {
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @GetMapping("/unread-count")
    public Map<String, Long> getUnreadCount(@RequestParam Long userId) {
        long count = notificationRepository.countByUserIdAndIsReadFalse(userId);
        return Map.of("count", count);
    }

    @PatchMapping("/{id}/read")
    public Notification markAsRead(@PathVariable Long id) {
        Notification n = notificationRepository.findById(id)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found"));
        n.setRead(true);
        return notificationRepository.save(n);
    }

    @PatchMapping("/read-all")
    public Map<String, Object> markAllAsRead(@RequestParam Long userId) {
        List<Notification> list = notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
        list.forEach(n -> n.setRead(true));
        notificationRepository.saveAll(list);
        return Map.of("message", "All notifications marked as read");
    }
}

