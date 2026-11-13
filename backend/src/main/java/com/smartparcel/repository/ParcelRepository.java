package com.smartparcel.repository;

import com.smartparcel.model.Parcel;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ParcelRepository extends JpaRepository<Parcel, Long> {
    List<Parcel> findByFlatNumberOrderByReceivedAtDesc(String flatNumber);
    List<Parcel> findByFlatNumberOrDelegateFlatOrderByReceivedAtDesc(String flatNumber, String delegateFlat);
    List<Parcel> findAllByOrderByReceivedAtDesc();
    List<Parcel> findByBundleCode(String bundleCode);
    boolean existsByTrackingNumber(String trackingNumber);
}
