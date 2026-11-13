package com.smartparcel.config;

import com.smartparcel.model.*;
import com.smartparcel.repository.*;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.List;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final ParcelRepository parcelRepository;
    private final NotificationRepository notificationRepository;

    public DataInitializer(UserRepository userRepository,
            ParcelRepository parcelRepository,
            NotificationRepository notificationRepository) {
        this.userRepository = userRepository;
        this.parcelRepository = parcelRepository;
        this.notificationRepository = notificationRepository;
    }

    @Override
    public void run(String... args) {
        if (userRepository.count() == 0) {
            // Seed Admin
            User admin = new User();
            admin.setName("Society Administrator");
            admin.setEmail("admin@smartparcel.com");
            admin.setPassword("admin123");
            admin.setPhone("+91 98765 00001");
            admin.setRole(UserRole.ROLE_ADMIN);
            admin.setActive(true);
            userRepository.save(admin);

            // Seed Delivery Agent
            User agent = new User();
            agent.setName("Ramesh Kumar (Delivery Agent)");
            agent.setEmail("agent@smartparcel.com");
            agent.setPassword("agent123");
            agent.setPhone("+91 98765 00002");
            agent.setRole(UserRole.ROLE_DELIVERY_AGENT);
            agent.setActive(true);
            userRepository.save(agent);

            // Seed Resident 1 (Flat A-101)
            User res1 = new User();
            res1.setName("Aarav Sharma");
            res1.setEmail("aarav@smartparcel.com");
            res1.setPassword("resident123");
            res1.setPhone("+91 98765 12001");
            res1.setFlatNumber("A-101");
            res1.setRole(UserRole.ROLE_RESIDENT);
            res1.setActive(true);
            User savedRes1 = userRepository.save(res1);

            // Seed Resident 2 (Flat B-202)
            User res2 = new User();
            res2.setName("Meera Nambiar");
            res2.setEmail("meera@smartparcel.com");
            res2.setPassword("resident123");
            res2.setPhone("+91 98765 77202");
            res2.setFlatNumber("B-202");
            res2.setRole(UserRole.ROLE_RESIDENT);
            res2.setActive(true);
            userRepository.save(res2);

            // Seed Resident 3 (Flat C-301)
            User res3 = new User();
            res3.setName("Kavita Menon");
            res3.setEmail("kavita@smartparcel.com");
            res3.setPassword("resident123");
            res3.setPhone("+91 98765 99301");
            res3.setFlatNumber("C-301");
            res3.setRole(UserRole.ROLE_RESIDENT);
            res3.setActive(true);
            userRepository.save(res3);

            // Initial Sample Notification for Aarav (A-101)
            Notification welcomeNotif = new Notification(
                    savedRes1.getId(),
                    null,
                    "Welcome to SmartParcel OS",
                    "Your apartment suite Flat A-101 is registered. Receive live arrival updates, message your delivery agent directly, and view private handover OTPs here.",
                    NotificationType.SYSTEM);
            notificationRepository.save(welcomeNotif);
        }

        // Ensure next-door neighbor A-102 exists for Delegate Authorization workflows
        if (userRepository.findByEmail("rajesh@smartparcel.com").isEmpty()) {
            User neighbor = new User();
            neighbor.setName("Rajesh Patel");
            neighbor.setEmail("rajesh@smartparcel.com");
            neighbor.setPassword("resident123");
            neighbor.setPhone("+91 98765 34102");
            neighbor.setFlatNumber("A-102");
            neighbor.setRole(UserRole.ROLE_RESIDENT);
            neighbor.setActive(true);
            userRepository.save(neighbor);
        }
    }
}
