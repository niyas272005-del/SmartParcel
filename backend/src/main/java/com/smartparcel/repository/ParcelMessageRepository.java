package com.smartparcel.repository;

import com.smartparcel.model.ParcelMessage;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ParcelMessageRepository extends JpaRepository<ParcelMessage, Long> {
    List<ParcelMessage> findByParcelIdOrderByCreatedAtAsc(Long parcelId);
    List<ParcelMessage> findAllByOrderByCreatedAtAsc();
    void deleteByParcelId(Long parcelId);
}

