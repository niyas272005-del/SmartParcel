# Project Abstract

## Title
SmartParcel – Smart Apartment Parcel Management and Scheduled Delivery System

## Abstract
Apartment residents often miss parcel deliveries because courier agents arrive when residents are away from home. Security desks may receive many packages, making manual tracking and handover difficult. SmartParcel is a web-based parcel management application designed to organize parcel receipt and scheduled handover within an apartment community.

The system provides three role-oriented workspaces: Resident, Security Staff and Administrator. Security staff can register incoming parcels with courier and flat details. Residents can view parcels associated with their flat and select a preferred delivery or collection time window. Staff can generate a demonstration one-time password (OTP) and confirm the handover after verification. Administrators can view parcel activity and basic status summaries.

The frontend is developed using React and the backend uses Java Spring Boot REST APIs. MySQL stores parcel records. The application aims to improve visibility, reduce missed handovers and provide a simple digital record of parcel movement. The current implementation is an academic MVP; real-world deployment would require stronger authentication, private OTP delivery, audit logging and operational security controls.

## Objectives
1. Digitize parcel registration at apartment security desks.
2. Allow residents to view parcels assigned to their flats.
3. Allow residents to choose a preferred time window.
4. Record parcel handover using an OTP verification workflow.
5. Provide administrators with a centralized parcel overview.

## Modules
- Resident module
- Security staff module
- Administrator module
- Parcel and time-slot management
- OTP-based handover demonstration

## Future Enhancements
- Spring Security with JWT authentication and account management
- SMS, WhatsApp or email notifications
- QR code scanning
- Smart locker integration
- Courier partner integration
- Audit reports and analytics
