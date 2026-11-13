# SmartParcel – Viva / Oral Exam Preparation Guide

This guide contains the most frequently asked questions by university external examiners, professors, and evaluation committees during Final Year Project defenses, along with clear and concise answers.

---

## 1. Project Concept & Architecture

### Q1: What is the core problem that SmartParcel solves?
**Answer:**
Apartment communities handle hundreds of e-commerce parcels daily from diverse couriers (Amazon, Flipkart, Delhivery, etc.). Couriers often arrive when residents are away, leading to disorganized parcel pile-ups at the security gate desk and risk of package misplacement. SmartParcel solves this by:
1. Digitizing gate parcel registration.
2. Giving residents real-time visibility into their packages.
3. Enabling residents to schedule delivery/collection time slots.
4. Securing handovers via OTP verification to prevent unauthorized collection.
5. Providing administrators with a centralized audit log.

### Q2: What is the architectural pattern of this project?
**Answer:**
SmartParcel follows a decoupled **Client-Server Architecture** (3-Tier):
* **Presentation Tier**: Single Page Application (SPA) built using **React** and **Vite**, communicating asynchronously with the backend via RESTful JSON APIs.
* **Application / Business Logic Tier**: Built with **Java 21** and **Spring Boot 3.4**, implementing controller-service-repository patterns, Bean Validation, and REST API controllers.
* **Data Tier**: Relational database engine powered by **MySQL 8.0**, managed via **Spring Data JPA** and **Hibernate ORM**.

---

## 2. Backend & Spring Boot

### Q3: Why did you choose Spring Boot for the backend?
**Answer:**
Spring Boot provides:
* **Rapid development** with opinionated starter dependencies (`spring-boot-starter-web`, `spring-boot-starter-data-jpa`, `spring-boot-starter-validation`).
* **Embedded Tomcat server**, eliminating the need for external web server configuration.
* **Enterprise reliability**: Built-in transactional management, production-grade exception handling (`@RestControllerAdvice`), and mature ORM integration.

### Q4: How is data validation handled in the backend?
**Answer:**
We use **Jakarta Bean Validation** (Hibernate Validator) with annotations on DTO records:
* `@NotBlank` and `@Size` on fields like `trackingNumber`, `courier`, and `flatNumber`.
* `@Pattern(regexp = "^[0-9]{6}$")` on `HandoverRequest.otp` to ensure exactly 6 numeric digits.
* `@Pattern` on `SlotRequest.slot` to restrict inputs to valid delivery windows.
* `@RestControllerAdvice` (`ApiExceptionHandler`) catches `MethodArgumentNotValidException` and returns clean, informative JSON error responses with HTTP `400 Bad Request`.

### Q5: How are unique constraints enforced?
**Answer:**
Tracking numbers are unique identifiers. Uniqueness is enforced at two levels:
1. **Application Level**: `ParcelRepository.existsByTrackingNumber()` checks if the tracking ID exists before saving, throwing an HTTP `409 Conflict`.
2. **Database Level**: `@Column(unique = true)` and `@Table(uniqueConstraints = ...)` enforce a database-level unique constraint on `tracking_number`.

---

## 3. Frontend & User Experience

### Q6: Why did you choose React and Vite?
**Answer:**
* **Component-Driven UI**: Modular, declarative components for each role (Security Desk, Resident Portal, Admin).
* **High Performance**: Vite provides instant Hot Module Replacement (HMR) and optimized ES-module bundling, ensuring sub-second response times.
* **Responsive State Management**: React hooks (`useState`, `useEffect`, `useMemo`) efficiently manage real-time filtering, search, and dynamic statistics calculations without re-rendering unnecessary DOM elements.

### Q7: How does the role-based view work in the frontend?
**Answer:**
For academic demonstration, role switching is implemented via an interactive navigation bar with three modes:
* **Security Desk**: Focuses on intake registration, tracking number generation, OTP verification, and handover receipt issuance.
* **Resident Portal**: Scoped to the selected apartment flat (e.g., `A-101`), displaying incoming packages, a 3-stage delivery progress stepper, delivery slot booking, and digital pickup passes.
* **Admin & Audit**: Centralized KPI metrics, courier distribution, CSV audit export, and sample data seeding.

---

## 4. Handover & Security Workflow

### Q8: How does the OTP handover verification work?
**Answer:**
1. When a resident comes to collect a package, the security guard clicks **"Generate Demo OTP"**.
2. The server generates a cryptographically random 6-digit number using `java.security.SecureRandom`, hashes/stores it against the parcel record, and returns it.
3. The guard submits the OTP entered by the resident.
4. The server validates the OTP against the stored code.
5. Upon successful match, the parcel status changes from `SLOT_BOOKED`/`RECEIVED` to `HANDED_OVER`, the OTP is cleared from storage (preventing replay attacks), and the handover timestamp (`handedOverAt`) is recorded.

### Q9: Why is the OTP visible in this project?
**Answer:**
In a production deployment, the OTP would be sent privately to the resident via SMS (e.g., Twilio) or WhatsApp Business API. In this academic prototype, the OTP is displayed on screen to allow evaluators and examiners to test and verify the entire handover lifecycle without requiring third-party paid SMS gateway credentials.

---

## 5. Testing & Code Quality

### Q10: How did you test the application?
**Answer:**
We implemented **10 automated integration and unit test cases** using JUnit 5 and Spring Boot MockMvc:
* **TC01**: Health check endpoint status verification.
* **TC02**: Successful parcel creation.
* **TC03**: Input validation rejection on missing mandatory fields.
* **TC04**: Resident flat-level data isolation.
* **TC05**: Delivery slot booking status transition.
* **TC06**: 6-digit OTP generation format validation.
* **TC07**: Handover rejection on invalid OTP.
* **TC08**: Handover completion on valid OTP.
* **TC09**: Handover rejection on already completed parcels.
* **TC10**: Parcel deletion and 404 verification.

All tests run via `mvnw.cmd test` against an isolated in-memory H2 database, achieving a **100% pass rate**.

---

## 6. Future Enhancements

### Q11: What features would you add in Phase 2 for commercial deployment?
**Answer:**
1. **Spring Security & JWT Authentication**: User accounts with encrypted passwords (BCrypt) and role-based access tokens.
2. **Third-Party SMS/WhatsApp Delivery**: Integration with Twilio or Gupshup for private OTP delivery directly to residents' mobile phones.
3. **Smart Locker Hardware Integration**: Microcontroller-controlled (ESP32/Raspberry Pi) physical locker compartments that unlock upon OTP entry.
4. **Barcode/QR Scanner Hardware**: Physical camera scanner integration at the gate for scanning courier barcodes directly into the intake form.

