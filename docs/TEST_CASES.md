# Test Cases

| ID | Scenario | Steps | Expected result |
|---|---|---|---|
| TC01 | API health | Open `/api/health` | Returns status UP |
| TC02 | Register parcel | Submit valid tracking, courier and flat | Parcel is saved |
| TC03 | Required fields | Submit without tracking number | Validation error |
| TC04 | Resident parcel view | Query resident role with flat A-101 | Only A-101 parcels returned |
| TC05 | Book time slot | PATCH a parcel with a slot | Status becomes SLOT_BOOKED |
| TC06 | Generate OTP | Request OTP for parcel | Demo OTP returned |
| TC07 | Wrong OTP | Submit incorrect OTP | Handover rejected |
| TC08 | Correct OTP | Submit generated OTP | Status becomes HANDED_OVER |
| TC09 | Repeated handover | Try to hand over completed parcel | Request rejected |
| TC10 | Responsive UI | Open app on mobile viewport | Layout adapts to screen |
