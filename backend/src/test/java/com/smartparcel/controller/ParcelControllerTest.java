package com.smartparcel.controller;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.smartparcel.dto.*;
import com.smartparcel.model.Parcel;
import com.smartparcel.model.User;
import com.smartparcel.model.UserRole;
import com.smartparcel.repository.ParcelMessageRepository;
import com.smartparcel.repository.ParcelRepository;
import com.smartparcel.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
class ParcelControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private ParcelRepository parcelRepository;

    @Autowired
    private ParcelMessageRepository parcelMessageRepository;

    @Autowired
    private UserRepository userRepository;

    @BeforeEach
    void setup() {
        parcelMessageRepository.deleteAll();
        parcelRepository.deleteAll();
        // Keep seeded resident preferences clean across tests
        for (User u : userRepository.findAll()) {
            u.setDefaultInstruction(null);
            u.setDefaultSlot(null);
            u.setQuietHoursEnabled(false);
            u.setQuietHoursStart(null);
            u.setQuietHoursEnd(null);
            u.setVacationMode(false);
            u.setVacationFrom(null);
            u.setVacationUntil(null);
            userRepository.save(u);
        }
    }

    @Test
    @DisplayName("TC01: Health check endpoint returns status UP")
    void tc01_healthCheck() throws Exception {
        mockMvc.perform(get("/api/health"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("UP")))
            .andExpect(jsonPath("$.application", is("SmartParcel")));
    }

    @Test
    @DisplayName("TC02: Register parcel saves valid parcel")
    void tc02_registerParcel() throws Exception {
        CreateParcelRequest req = new CreateParcelRequest(
            "TRK-TC02-123", "Amazon", "A-101", "John Resident", "Laptop stand"
        );

        mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id", notNullValue()))
            .andExpect(jsonPath("$.trackingNumber", is("TRK-TC02-123")))
            .andExpect(jsonPath("$.status", is("RECEIVED")));
    }

    @Test
    @DisplayName("TC03: Register parcel fails when tracking number is blank")
    void tc03_validationErrorOnBlankTrackingNumber() throws Exception {
        CreateParcelRequest req = new CreateParcelRequest(
            "", "Amazon", "A-101", "John Resident", "Item"
        );

        mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message", containsString("trackingNumber")));
    }

    @Test
    @DisplayName("TC04: Resident view only returns parcels for their flat")
    void tc04_residentViewFiltering() throws Exception {
        mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-FLAT-A", "Amazon", "A-101", "Alice", "Box 1"))));

        mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-FLAT-B", "Flipkart", "B-202", "Bob", "Box 2"))));

        mockMvc.perform(get("/api/parcels")
                .param("role", "RESIDENT")
                .param("flatNumber", "A-101"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].flatNumber", is("A-101")))
            .andExpect(jsonPath("$[0].trackingNumber", is("TRK-FLAT-A")));
    }

    @Test
    @DisplayName("TC05: Book time slot updates parcel status to SLOT_BOOKED")
    void tc05_bookTimeSlot() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-SLOT-1", "Delhivery", "A-101", "Alice", "Books"))))
            .andExpect(status().isOk())
            .andReturn();

        JsonNode json = objectMapper.readTree(createdResult.getResponse().getContentAsString());
        long id = json.get("id").asLong();

        SlotRequest slotReq = new SlotRequest("10:00 AM - 12:00 PM");

        mockMvc.perform(patch("/api/parcels/" + id + "/slot")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(slotReq)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("SLOT_BOOKED")))
            .andExpect(jsonPath("$.slot", is("10:00 AM - 12:00 PM")));
    }

    @Test
    @DisplayName("TC06: Generate OTP returns 6-digit demo OTP")
    void tc06_generateOtp() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-OTP-1", "India Post", "C-301", "Charlie", "Document"))))
            .andExpect(status().isOk())
            .andReturn();

        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/parcels/" + id + "/generate-otp"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.demoOtp", matchesPattern("^[0-9]{6}$")))
            .andExpect(jsonPath("$.warning", notNullValue()));
    }

    @Test
    @DisplayName("TC07: Handover fails when incorrect OTP is entered")
    void tc07_handoverWrongOtp() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-FAIL-1", "Amazon", "A-101", "Alice", "Clothes"))))
            .andReturn();
        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/parcels/" + id + "/generate-otp")).andExpect(status().isOk());

        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest("000000"))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message", containsString("Invalid OTP")));
    }

    @Test
    @DisplayName("TC08: Handover succeeds with correct OTP and updates status to HANDED_OVER")
    void tc08_handoverCorrectOtp() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-PASS-1", "Amazon", "A-101", "Alice", "Clothes"))))
            .andReturn();
        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        MvcResult otpResult = mockMvc.perform(post("/api/parcels/" + id + "/generate-otp"))
            .andExpect(status().isOk())
            .andReturn();

        String otp = objectMapper.readTree(otpResult.getResponse().getContentAsString()).get("demoOtp").asText();

        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest(otp))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message", containsString("successfully")));

        mockMvc.perform(get("/api/parcels/" + id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("HANDED_OVER")));
    }

    @Test
    @DisplayName("TC09: Handover fails when parcel is already handed over")
    void tc09_repeatedHandoverRejected() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-DUP-1", "Amazon", "A-101", "Alice", "Clothes"))))
            .andReturn();
        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        MvcResult otpResult = mockMvc.perform(post("/api/parcels/" + id + "/generate-otp")).andReturn();
        String otp = objectMapper.readTree(otpResult.getResponse().getContentAsString()).get("demoOtp").asText();

        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest(otp))))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest(otp))))
            .andExpect(status().isConflict())
            .andExpect(jsonPath("$.message", containsString("already handed over")));
    }

    @Test
    @DisplayName("TC10: Delete parcel removes record")
    void tc10_deleteParcel() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-DEL-1", "Amazon", "A-101", "Alice", "Box"))))
            .andReturn();
        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(delete("/api/parcels/" + id))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.message", containsString("deleted successfully")));

        mockMvc.perform(get("/api/parcels/" + id))
            .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("TC11: Direct Delivery Agent and Resident chat messages & summary work end-to-end")
    void tc11_directParcelMessaging() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-CHAT-1", "Amazon", "A-101", "Aarav", "Headphones"))))
            .andExpect(status().isOk())
            .andReturn();

        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        SendMessageRequest residentReply = new SendMessageRequest(null, "Aarav Sharma", UserRole.ROLE_RESIDENT, "Please leave at my doorstep");
        mockMvc.perform(post("/api/parcels/" + id + "/messages")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(residentReply)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.senderRole", is("ROLE_RESIDENT")))
            .andExpect(jsonPath("$.message", is("Please leave at my doorstep")));

        mockMvc.perform(get("/api/parcels/" + id + "/messages"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(2)))
            .andExpect(jsonPath("$[1].message", is("Please leave at my doorstep")));

        mockMvc.perform(get("/api/parcels/messages-summary"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$." + id + ".count", is(2)))
            .andExpect(jsonPath("$." + id + ".lastMessage", is("Please leave at my doorstep")));
    }

    @Test
    @DisplayName("TC12: Resident delivery instruction updates parcel and Delivery Agent role can list parcels")
    void tc12_deliveryInstructionAndAgentList() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-INST-1", "BlueDart", "B-202", "Meera", "Books"))))
            .andExpect(status().isOk())
            .andReturn();

        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/parcels/" + id + "/instruction")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new InstructionRequest("Call on arrival", "Meera"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.deliveryInstruction", is("Call on arrival")));

        mockMvc.perform(get("/api/parcels").param("role", "DELIVERY_AGENT"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].deliveryInstruction", is("Call on arrival")));
    }

    @Test
    @DisplayName("TC13: Resident can reschedule parcel to tomorrow/future date with RESCHEDULED status and reason")
    void tc13_rescheduleParcelForFutureDate() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-RESCH-1", "Flipkart", "C-301", "Kavita", "Shoes"))))
            .andExpect(status().isOk())
            .andReturn();

        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        RescheduleRequest req = new RescheduleRequest("2026-11-12", "4:00 PM – 6:00 PM", "Not at home today");
        mockMvc.perform(patch("/api/parcels/" + id + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(req)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("RESCHEDULED")))
            .andExpect(jsonPath("$.preferredDate", is("2026-11-12")))
            .andExpect(jsonPath("$.slot", is("4:00 PM – 6:00 PM")))
            .andExpect(jsonPath("$.rescheduleReason", is("Not at home today")));

        mockMvc.perform(get("/api/parcels/stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.rescheduled", is(1)))
            .andExpect(jsonPath("$.activeAtDesk", is(1)));
    }

    @Test
    @DisplayName("TC14: Resident can reschedule only once — second reschedule and slot change return 409 Conflict")
    void tc14_secondRescheduleAndSlotRejected() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-RESCH-ONCE", "Amazon", "A-101", "Aarav", "Gadget"))))
            .andExpect(status().isOk())
            .andReturn();

        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/parcels/" + id + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RescheduleRequest("2026-11-12", "4:00 PM – 6:00 PM", "Not at home today"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("RESCHEDULED")))
            .andExpect(jsonPath("$.rescheduledOnce", is(true)));

        mockMvc.perform(patch("/api/parcels/" + id + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RescheduleRequest("2026-11-13", "7:00 PM – 9:00 PM", "Try another day"))))
            .andExpect(status().isConflict());

        mockMvc.perform(patch("/api/parcels/" + id + "/slot")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SlotRequest("10:00 AM – 12:00 PM", null))))
            .andExpect(status().isConflict());
    }

    @Test
    @DisplayName("TC15: Leave at doorstep / Contactless handover requires Safe-Drop photo proof and saves it on receipt")
    void tc15_safeDropPhotoProofEnforcement() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-SAFEDROP", "Amazon", "A-101", "Aarav", "Skincare box"))))
            .andExpect(status().isOk())
            .andReturn();

        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/parcels/" + id + "/instruction")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new InstructionRequest("Leave at doorstep", "Aarav"))))
            .andExpect(status().isOk());

        MvcResult otpResult = mockMvc.perform(post("/api/parcels/" + id + "/generate-otp"))
            .andExpect(status().isOk())
            .andReturn();
        String otp = objectMapper.readTree(otpResult.getResponse().getContentAsString()).get("demoOtp").asText();

        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest(otp))))
            .andExpect(status().isBadRequest())
            .andExpect(jsonPath("$.message", containsString("photo proof is required")));

        String samplePhoto = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/";
        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest(otp, samplePhoto, "Left by mat", "QR_SCAN"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.verifiedMethod", is("QR Pass + OTP + Safe-Drop Photo")))
            .andExpect(jsonPath("$.parcel.proofPhotoUrl", is(samplePhoto)))
            .andExpect(jsonPath("$.parcel.proofNote", is("Left by mat")));
    }

    @Test
    @DisplayName("TC16: Neighbor delegate authorization grants neighbor visibility, issues delegate OTP, and completes handover")
    void tc16_delegateNeighborAuthorizationAndHandover() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-DELEGATE-1", "Flipkart", "A-101", "Aarav", "Groceries"))))
            .andExpect(status().isOk())
            .andReturn();

        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/parcels/" + id + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new RescheduleRequest("2026-11-12", "4:00 PM – 6:00 PM", "Busy"))))
            .andExpect(status().isOk());

        MvcResult delegateRes = mockMvc.perform(post("/api/parcels/" + id + "/delegate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new DelegateRequest("a-102", "Rajesh Patel", "+91 98765 34102", "Hand to neighbor"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.delegated", is(true)))
            .andExpect(jsonPath("$.delegateFlat", is("A-102")))
            .andExpect(jsonPath("$.delegateOtp", matchesPattern("^[0-9]{6}$")))
            .andReturn();

        String delegateOtp = objectMapper.readTree(delegateRes.getResponse().getContentAsString()).get("delegateOtp").asText();

        mockMvc.perform(get("/api/parcels").param("role", "RESIDENT").param("flatNumber", "A-102"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(1)))
            .andExpect(jsonPath("$[0].trackingNumber", is("TRK-DELEGATE-1")));

        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest(delegateOtp, null, null, null))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.handedOverTo", is("Rajesh Patel (Delegate · Flat A-102)")))
            .andExpect(jsonPath("$.verifiedMethod", is("Delegate OTP")));
    }

    @Test
    @DisplayName("TC17: Resident can revoke delegate pass before handover")
    void tc17_revokeDelegateAuthorization() throws Exception {
        MvcResult createdResult = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-REV-1", "BlueDart", "A-101", "Aarav", "Documents"))))
            .andReturn();

        long id = objectMapper.readTree(createdResult.getResponse().getContentAsString()).get("id").asLong();

        MvcResult delegateRes = mockMvc.perform(post("/api/parcels/" + id + "/delegate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new DelegateRequest("B-202", "Meera Nambiar", null, null))))
            .andExpect(status().isOk())
            .andReturn();
        String oldOtp = objectMapper.readTree(delegateRes.getResponse().getContentAsString()).get("delegateOtp").asText();

        mockMvc.perform(delete("/api/parcels/" + id + "/delegate"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.delegated", is(false)))
            .andExpect(jsonPath("$.delegateFlat").doesNotExist());

        mockMvc.perform(get("/api/parcels").param("role", "RESIDENT").param("flatNumber", "B-202"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(0)));

        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest(oldOtp))))
            .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("TC18: Trusted neighbors endpoint lists active resident flats excluding caller without exposing passwords")
    void tc18_trustedNeighborsDirectory() throws Exception {
        mockMvc.perform(get("/api/auth/neighbors").param("excludeFlat", "A-101"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$", hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$[*].flatNumber", not(hasItem("A-101"))))
            .andExpect(jsonPath("$[0].password").doesNotExist());
    }

    @Test
    @DisplayName("TC19: Agent active route sorts deliverable parcels by block and floor (A-101 -> A-304 -> B-202) with holds after")
    void tc19_agentRouteBatchingOrder() throws Exception {
        mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-B202", "Flipkart", "B-202", "Meera", "Box B2"))));

        mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-A304", "Amazon", "A-304", "Neha", "Box A3"))));

        mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-A101", "BlueDart", "A-101", "Aarav", "Box A1"))));

        MvcResult holdCreated = mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-HOLD", "DTDC", "A-102", "Rajesh", "Hold Box"))))
            .andReturn();
        long holdId = objectMapper.readTree(holdCreated.getResponse().getContentAsString()).get("id").asLong();
        mockMvc.perform(patch("/api/parcels/" + holdId + "/reschedule")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new RescheduleRequest("2026-11-12", "4:00 PM – 6:00 PM", "Away"))));

        mockMvc.perform(get("/api/parcels")
                .param("role", "DELIVERY_AGENT")
                .param("sort", "route"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].flatNumber", is("A-101")))
            .andExpect(jsonPath("$[1].flatNumber", is("A-304")))
            .andExpect(jsonPath("$[2].flatNumber", is("B-202")))
            .andExpect(jsonPath("$[3].flatNumber", is("A-102")));
    }

    @Test
    @DisplayName("TC20: Resident route queue shows exact drops ahead without leaking neighbor details")
    void tc20_residentQueueIndicatorAndPrivacy() throws Exception {
        mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-Q1", "Amazon", "A-101", "Aarav", "Item 1"))));

        mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-Q2", "Flipkart", "A-304", "Neha", "Item 2"))));

        MvcResult b202Res = mockMvc.perform(post("/api/parcels")
            .contentType(MediaType.APPLICATION_JSON)
            .content(objectMapper.writeValueAsString(new CreateParcelRequest("TRK-Q3", "BlueDart", "B-202", "Meera", "Item 3"))))
            .andReturn();
        long b202Id = objectMapper.readTree(b202Res.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/parcels/route-queue")
                .param("role", "RESIDENT")
                .param("flatNumber", "B-202"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.totalActiveDrops", is(3)))
            .andExpect(jsonPath("$.totalStops", is(3)))
            .andExpect(jsonPath("$.routeStops").doesNotExist())
            .andExpect(jsonPath("$.dropsByParcelId." + b202Id + ".dropsAhead", is(2)))
            .andExpect(jsonPath("$.dropsByParcelId." + b202Id + ".stopNumber", is(3)))
            .andExpect(jsonPath("$.dropsByParcelId." + b202Id + ".queueMessage", is("2 drops ahead of Flat B-202")));
    }

    @Test
    @DisplayName("TC21: Resident default doorstep rule & quiet hours auto-apply on newly dispatched parcel")
    void tc21_residentDefaultPreferencesAutoApply() throws Exception {
        User aarav = userRepository.findByEmail("aarav@smartparcel.com").orElseThrow();
        UserPreferencesRequest prefs = new UserPreferencesRequest(
            "Always leave outside door after 8 PM",
            "7:00 PM – 9:00 PM",
            true,
            "20:00",
            "07:00",
            false,
            null,
            null
        );
        mockMvc.perform(put("/api/auth/users/" + aarav.getId() + "/preferences")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(prefs)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.preferences.quietHoursEnabled", is(true)))
            .andExpect(jsonPath("$.preferences.defaultSlot", is("7:00 PM – 9:00 PM")));

        mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-PREF-1", "Amazon", "A-101", "Aarav Sharma", "Headphones"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("SLOT_BOOKED")))
            .andExpect(jsonPath("$.slot", is("7:00 PM – 9:00 PM")))
            .andExpect(jsonPath("$.deliveryInstruction", containsString("Always leave outside door after 8 PM")))
            .andExpect(jsonPath("$.deliveryInstruction", containsString("Quiet hours 20:00–07:00")));
    }

    @Test
    @DisplayName("TC22: Resident Vacation Mode auto-holds incoming parcels until day after return")
    void tc22_vacationModeAutoHoldsDispatch() throws Exception {
        User kavita = userRepository.findByEmail("kavita@smartparcel.com").orElseThrow();
        String today = LocalDate.now().toString();
        String until = LocalDate.now().plusDays(2).toString();
        String expectedResume = LocalDate.now().plusDays(3).toString();

        UserPreferencesRequest vacationPrefs = new UserPreferencesRequest(
            "Leave at doorstep",
            "4:00 PM – 6:00 PM",
            false,
            null,
            null,
            true,
            today,
            until
        );
        mockMvc.perform(put("/api/auth/users/" + kavita.getId() + "/preferences")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(vacationPrefs)))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.preferences.vacationActiveToday", is(true)));

        mockMvc.perform(get("/api/auth/flat-preferences").param("flatNumber", "C-301"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.vacationActiveToday", is(true)))
            .andExpect(jsonPath("$.vacationUntil", is(until)));

        mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-VAC-1", "Flipkart", "C-301", "Kavita", "Shoes"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("RESCHEDULED")))
            .andExpect(jsonPath("$.preferredDate", is(expectedResume)))
            .andExpect(jsonPath("$.rescheduledOnce", is(true)))
            .andExpect(jsonPath("$.rescheduleReason", containsString("Vacation Mode active")));
    }

    @Test
    @DisplayName("TC23: Post-delivery issue dispute flag and Admin/Agent resolution audit workflow")
    void tc23_postDeliveryIssueAndResolve() throws Exception {
        MvcResult created = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-ISS-1", "BlueDart", "B-202", "Meera", "Glassware"))))
            .andExpect(status().isOk())
            .andReturn();
        long id = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        // Reject issue report before delivery completes
        mockMvc.perform(post("/api/parcels/" + id + "/issue")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new ReportIssueRequest("Damaged Box", "Crushed corner", null, "Meera"))))
            .andExpect(status().isConflict());

        // Complete OTP handover
        MvcResult otpRes = mockMvc.perform(post("/api/parcels/" + id + "/generate-otp"))
            .andExpect(status().isOk())
            .andReturn();
        String otp = objectMapper.readTree(otpRes.getResponse().getContentAsString()).get("demoOtp").asText();
        mockMvc.perform(post("/api/parcels/" + id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new HandoverRequest(otp))))
            .andExpect(status().isOk());

        // Report post-delivery issue
        mockMvc.perform(post("/api/parcels/" + id + "/issue")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new ReportIssueRequest("Damaged Box", "Outer seal torn on corner", "data:image/png;base64,AAA", "Meera"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.issueReported", is(true)))
            .andExpect(jsonPath("$.issueCategory", is("Damaged Box")))
            .andExpect(jsonPath("$.issueStatus", is("OPEN")));

        // Admin resolves issue
        mockMvc.perform(patch("/api/parcels/" + id + "/issue/resolve")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new ResolveIssueRequest("RESOLVED", "Replacement coordinated with courier", "Society Admin"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.issueStatus", is("RESOLVED")))
            .andExpect(jsonPath("$.issueResolutionNote", is("Replacement coordinated with courier")));
    }

    @Test
    @DisplayName("TC24: 5-Star delivery rating calculates live Agent Trust Score & top tags")
    void tc24_deliveryRatingAndAgentTrustScore() throws Exception {
        User agent = userRepository.findByRole(UserRole.ROLE_DELIVERY_AGENT).get(0);

        MvcResult created1 = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-RATE-1", "Amazon", "A-101", "Aarav", null, "Box", "Book", agent.getId(), agent.getName(), agent.getPhone()))))
            .andReturn();
        long id1 = objectMapper.readTree(created1.getResponse().getContentAsString()).get("id").asLong();

        MvcResult otp1 = mockMvc.perform(post("/api/parcels/" + id1 + "/generate-otp")).andReturn();
        mockMvc.perform(post("/api/parcels/" + id1 + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new HandoverRequest(objectMapper.readTree(otp1.getResponse().getContentAsString()).get("demoOtp").asText()))))
            .andExpect(status().isOk());

        mockMvc.perform(post("/api/parcels/" + id1 + "/rate")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new RateParcelRequest(5, List.of("Fast", "Followed Instructions"), "Super smooth handover!"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.parcel.deliveryRating", is(5)))
            .andExpect(jsonPath("$.parcel.ratingTags", is("Fast, Followed Instructions")))
            .andExpect(jsonPath("$.agentTrust.overall.averageRating", is(5.0)))
            .andExpect(jsonPath("$.agentTrust.byAgentId." + agent.getId() + ".ratingCount", is(1)))
            .andExpect(jsonPath("$.agentTrust.byAgentId." + agent.getId() + ".topTags[0].tag", is("Fast")));
    }

    @Test
    @DisplayName("TC25: SLA breach detection (<15m fresh, 180-239m risk, >=4h overdue, excluding rescheduled holds) and escalations")
    void tc25_slaBreachDetectionAndEscalation() throws Exception {
        MvcResult overRes = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-SLA-OVER", "Amazon", "A-101", "Aarav Sharma", "Router"))))
            .andExpect(status().isOk())
            .andReturn();
        long overId = objectMapper.readTree(overRes.getResponse().getContentAsString()).get("id").asLong();
        Parcel overParcel = parcelRepository.findById(overId).orElseThrow();
        overParcel.setReceivedAt(LocalDateTime.now().minusHours(5));
        parcelRepository.save(overParcel);

        MvcResult riskRes = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-SLA-RISK", "Flipkart", "B-202", "Meera", "Laptop Stand"))))
            .andExpect(status().isOk())
            .andReturn();
        long riskId = objectMapper.readTree(riskRes.getResponse().getContentAsString()).get("id").asLong();
        Parcel riskParcel = parcelRepository.findById(riskId).orElseThrow();
        riskParcel.setReceivedAt(LocalDateTime.now().minusMinutes(195));
        parcelRepository.save(riskParcel);

        MvcResult freshRes = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-SLA-FRESH", "BlueDart", "C-301", "Kavita", "Book"))))
            .andExpect(status().isOk())
            .andReturn();
        long freshId = objectMapper.readTree(freshRes.getResponse().getContentAsString()).get("id").asLong();

        // Single SLA risk escalation
        mockMvc.perform(post("/api/parcels/" + riskId + "/escalate-sla").param("actorName", "Ops Admin"))
            .andExpect(status().isOk());

        // Bulk overdue (>4h) escalation
        mockMvc.perform(post("/api/parcels/escalate-overdue").param("actorName", "Ops Admin"))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/parcels/stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.slaSummary.overdueCount", is(1)))
            .andExpect(jsonPath("$.slaSummary.atRiskCount", is(1)))
            .andExpect(jsonPath("$.slaSummary.totalAlertsCount", is(2)))
            .andExpect(jsonPath("$.slaSummary.under15mActive", is(1)))
            .andExpect(jsonPath("$.slaSummary.escalatedCount", is(2)))
            .andExpect(jsonPath("$.slaSummary.itemsByParcelId." + overId + ".tier", is("OVERDUE")))
            .andExpect(jsonPath("$.slaSummary.itemsByParcelId." + overId + ".isOverdue", is(true)))
            .andExpect(jsonPath("$.slaSummary.itemsByParcelId." + overId + ".isEscalated", is(true)))
            .andExpect(jsonPath("$.slaSummary.itemsByParcelId." + riskId + ".tier", is("SLA_RISK")))
            .andExpect(jsonPath("$.slaSummary.itemsByParcelId." + riskId + ".isSlaRisk", is(true)))
            .andExpect(jsonPath("$.slaSummary.itemsByParcelId." + freshId + ".tier", is("EXPRESS_FRESH")))
            .andExpect(jsonPath("$.slaSummary.itemsByParcelId." + freshId + ".isUnder15m", is(true)));
    }

    @Test
    @DisplayName("TC26: Express Analytics Dashboard stats (courier share, peak slots, reschedule rate, avg handover, trends)")
    void tc26_expressAnalyticsStatsTimeTrendsAndLeaderboard() throws Exception {
        User aarav = userRepository.findByEmail("aarav@smartparcel.com").orElseThrow();
        User kavita = userRepository.findByEmail("kavita@smartparcel.com").orElseThrow();
        User agent = userRepository.findAll().stream()
            .filter(u -> u.getRole() == UserRole.ROLE_DELIVERY_AGENT)
            .findFirst()
            .orElseThrow();

        // Save default slot preference for A-101 so dispatches auto-book slotBreakdown
        mockMvc.perform(put("/api/auth/users/" + aarav.getId() + "/preferences")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new UserPreferencesRequest("Leave at doorstep", "7:00 PM – 9:00 PM", false, null, null, false, null, null))))
            .andExpect(status().isOk());

        // Enable Vacation Mode for C-301 so incoming dispatch is auto-rescheduled
        mockMvc.perform(put("/api/auth/users/" + kavita.getId() + "/preferences")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new UserPreferencesRequest("Leave at doorstep", "4:00 PM – 6:00 PM", false, null, null, true,
                        LocalDate.now().toString(), LocalDate.now().plusDays(1).toString()))))
            .andExpect(status().isOk());

        // Parcel 1: Amazon, fast 10m handover
        long p1Id = objectMapper.readTree(mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-AN-1", "Amazon", "A-101", "Aarav Sharma", "Mouse"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        String otp1 = objectMapper.readTree(mockMvc.perform(post("/api/parcels/" + p1Id + "/generate-otp"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("demoOtp").asText();
        mockMvc.perform(post("/api/parcels/" + p1Id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new HandoverRequest(otp1, "data:image/png;base64,AAA", "Delivered cleanly", "MANUAL_OTP"))))
            .andExpect(status().isOk());
        Parcel p1 = parcelRepository.findById(p1Id).orElseThrow();
        p1.setReceivedAt(p1.getHandedOverAt().minusMinutes(10));
        parcelRepository.save(p1);

        // Parcel 2: Amazon, 30m handover
        long p2Id = objectMapper.readTree(mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-AN-2", "Amazon", "A-101", "Aarav Sharma", "Keyboard"))))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("id").asLong();
        String otp2 = objectMapper.readTree(mockMvc.perform(post("/api/parcels/" + p2Id + "/generate-otp"))
            .andExpect(status().isOk()).andReturn().getResponse().getContentAsString()).get("demoOtp").asText();
        mockMvc.perform(post("/api/parcels/" + p2Id + "/handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new HandoverRequest(otp2, "data:image/png;base64,AAA", "Delivered cleanly", "MANUAL_OTP"))))
            .andExpect(status().isOk());
        Parcel p2 = parcelRepository.findById(p2Id).orElseThrow();
        p2.setReceivedAt(p2.getHandedOverAt().minusMinutes(30));
        parcelRepository.save(p2);

        // Parcel 3: Flipkart, slotted active
        mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-AN-3", "Flipkart", "A-101", "Aarav Sharma", "Cable"))))
            .andExpect(status().isOk());

        // Parcel 4: BlueDart, auto-rescheduled via Vacation Mode
        mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-AN-4", "BlueDart", "C-301", "Kavita", "Gift"))))
            .andExpect(status().isOk());

        mockMvc.perform(get("/api/parcels/stats"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.total", is(4)))
            .andExpect(jsonPath("$.completed", is(2)))
            .andExpect(jsonPath("$.rescheduledFrequencyCount", is(1)))
            .andExpect(jsonPath("$.rescheduleRatePercent", is(25.0)))
            .andExpect(jsonPath("$.avgHandoverMinutes", is(20.0)))
            .andExpect(jsonPath("$.under15MinCount", is(1)))
            .andExpect(jsonPath("$.under15MinRatePercent", is(50.0)))
            .andExpect(jsonPath("$.courierBreakdown[0].courier", is("Amazon")))
            .andExpect(jsonPath("$.courierBreakdown[0].count", is(2)))
            .andExpect(jsonPath("$.courierBreakdown[0].percent", is(50.0)))
            .andExpect(jsonPath("$.peakSlot", notNullValue()))
            .andExpect(jsonPath("$.slotBreakdown", hasSize(greaterThanOrEqualTo(1))))
            .andExpect(jsonPath("$.rescheduleReasons", hasSize(1)))
            .andExpect(jsonPath("$.dailyTrends", hasSize(7)))
            .andExpect(jsonPath("$.hourlyArrivals", hasSize(6)))
            .andExpect(jsonPath("$.agentSpeedLeaderboard[0].agentName", is(p1.getAgentName())))
            .andExpect(jsonPath("$.agentSpeedLeaderboard[0].completedCount", is(2)));
    }

    @Test
    @DisplayName("TC27: Delivery agent confirms resident slot or reschedule and pushes confirmation message to customer")
    void tc27_agentConfirmsSlotAndRescheduleNotifiesResident() throws Exception {
        User aarav = userRepository.findByEmail("aarav@smartparcel.com").orElseThrow();
        MvcResult createdRes = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("TRK-CONF-1", "Amazon", "A-101", "Aarav Sharma", "Books"))))
            .andExpect(status().isOk())
            .andReturn();
        long parcelId = objectMapper.readTree(createdRes.getResponse().getContentAsString()).get("id").asLong();

        // Cannot confirm before resident books a slot or reschedules
        mockMvc.perform(post("/api/parcels/" + parcelId + "/confirm-schedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new ConfirmScheduleRequest("Ramesh Kumar", "Confirmed!"))))
            .andExpect(status().isConflict());

        // Resident books today's slot
        mockMvc.perform(patch("/api/parcels/" + parcelId + "/slot")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new SlotRequest("7:00 PM – 9:00 PM"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.agentScheduleConfirmed", is(false)));

        // Delivery Agent confirms slot with custom message for resident
        mockMvc.perform(post("/api/parcels/" + parcelId + "/confirm-schedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new ConfirmScheduleRequest("Ramesh Kumar", "On my way at 7:30 PM with your Amazon parcel."))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.parcel.agentScheduleConfirmed", is(true)))
            .andExpect(jsonPath("$.parcel.agentScheduleConfirmedBy", is("Ramesh Kumar")))
            .andExpect(jsonPath("$.parcel.agentScheduleConfirmMessage", is("On my way at 7:30 PM with your Amazon parcel.")));

        // Resident notification inbox & chat timeline both carry confirming message
        mockMvc.perform(get("/api/notifications").param("userId", String.valueOf(aarav.getId())))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[0].type", is("AGENT_SCHEDULE_CONFIRMED")))
            .andExpect(jsonPath("$[0].message", is("On my way at 7:30 PM with your Amazon parcel.")));

        mockMvc.perform(get("/api/parcels/" + parcelId + "/messages"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$[?(@.message =~ /.*Schedule Confirmed.*On my way at 7:30 PM.*/)]", hasSize(1)));

        // Resident reschedules -> resets confirmation until agent confirms new reschedule
        String tomorrow = LocalDate.now().plusDays(1).toString();
        mockMvc.perform(patch("/api/parcels/" + parcelId + "/reschedule")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new RescheduleRequest(tomorrow, "4:00 PM – 6:00 PM", "Not home today"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.agentScheduleConfirmed", is(false)));

        // Delivery Agent confirms reschedule with default message
        mockMvc.perform(post("/api/parcels/" + parcelId + "/confirm-schedule"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.parcel.agentScheduleConfirmed", is(true)))
            .andExpect(jsonPath("$.parcel.agentScheduleConfirmMessage", containsString(tomorrow)))
            .andExpect(jsonPath("$.parcel.agentScheduleConfirmMessage", containsString("4:00 PM")));
    }

    @Test
    void test28_multiParcelBundlingAndHandover() throws Exception {
        // Register 2 parcels for Flat A-101 (Amazon + Blinkit)
        String p1 = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("BNDL-AMZ-01", "Amazon", "A-101", "Aarav Sharma", "+91 98765 12001", "Electronics", "Headphones"))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        Long id1 = objectMapper.readTree(p1).get("id").asLong();

        String p2 = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("BNDL-BLK-02", "Blinkit", "A-101", "Aarav Sharma", "+91 98765 12001", "Grocery", "Coffee Beans"))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        Long id2 = objectMapper.readTree(p2).get("id").asLong();

        // Bundle both parcels under 1 slot & Master Pass
        String bundleRes = mockMvc.perform(post("/api/parcels/bundle")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new BundleSlotRequest("A-101", List.of(id1, id2), "7:00 PM – 9:00 PM", "Today", "Leave with security if not home"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.bundleCode", containsString("BNDL-A101")))
            .andExpect(jsonPath("$.bundleSize", is(2)))
            .andExpect(jsonPath("$.masterOtp", notNullValue()))
            .andReturn().getResponse().getContentAsString();

        String bundleCode = objectMapper.readTree(bundleRes).get("bundleCode").asText();
        String masterOtp = objectMapper.readTree(bundleRes).get("masterOtp").asText();

        // Agent completes 1-tap handover of all bundled parcels with Master OTP
        mockMvc.perform(post("/api/parcels/bundle-handover")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new BundleHandoverRequest(bundleCode, masterOtp, "data:image/jpeg;base64,photoProof", "Bundled drop at door", "MASTER_OTP", "Ramesh Kumar"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.count", is(2)))
            .andExpect(jsonPath("$.verifiedMethod", containsString("Master OTP")));

        // Verify both parcels are HANDED_OVER
        mockMvc.perform(get("/api/parcels/" + id1))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("HANDED_OVER")))
            .andExpect(jsonPath("$.bundled", is(true)))
            .andExpect(jsonPath("$.bundleCode", is(bundleCode)));

        mockMvc.perform(get("/api/parcels/" + id2))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.status", is("HANDED_OVER")))
            .andExpect(jsonPath("$.bundled", is(true)));
    }

    @Test
    void test29_routeQueueEtaAlertsAndDoorstepNudge() throws Exception {
        // Create parcel for Flat A-101 and Flat B-202
        String p1 = mockMvc.perform(post("/api/parcels")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new CreateParcelRequest("ETA-TEST-01", "Amazon", "A-101", "Aarav", "+91 98765 12001", "Box", "Items"))))
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
        Long id1 = objectMapper.readTree(p1).get("id").asLong();

        // Verify route queue computes etaMinutes, etaLabel, and doorstepNudge
        mockMvc.perform(get("/api/parcels/route-queue").param("role", "DELIVERY_AGENT"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.dropsByParcelId." + id1 + ".etaMinutes", notNullValue()))
            .andExpect(jsonPath("$.dropsByParcelId." + id1 + ".doorstepNudge", notNullValue()))
            .andExpect(jsonPath("$.dropsByParcelId." + id1 + ".isDoorstepNow", notNullValue()));
    }

    @Test
    void test30_reversePickupScheduleAndCollection() throws Exception {
        // Resident schedules customer return pickup
        String retRes = mockMvc.perform(post("/api/parcels/return-pickup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new ReturnPickupRequest("Myntra", "A-101", "Aarav Sharma", "+91 98765 12001", "Size M too large", "MYN-998811", "4:00 PM – 6:00 PM", "Today", "Item packaged in return bag"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.returnPickup", is(true)))
            .andExpect(jsonPath("$.returnStatus", is("SCHEDULED")))
            .andExpect(jsonPath("$.trackingNumber", startsWith("RET-MYNTRA-")))
            .andExpect(jsonPath("$.returnOtp", notNullValue()))
            .andReturn().getResponse().getContentAsString();

        Long retId = objectMapper.readTree(retRes).get("id").asLong();
        String returnOtp = objectMapper.readTree(retRes).get("returnOtp").asText();

        // Agent verifies & collects return package with Reverse OTP
        mockMvc.perform(post("/api/parcels/" + retId + "/confirm-return-pickup")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(
                    new HandoverRequest(returnOtp, "data:image/jpeg;base64,returnBagProof", "Return bag sealed with barcode label", "OTP_INPUT"))))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.parcel.returnStatus", is("PICKED_UP")))
            .andExpect(jsonPath("$.parcel.status", is("HANDED_OVER")))
            .andExpect(jsonPath("$.verifiedMethod", containsString("Reverse-Handover OTP")));
    }
}

