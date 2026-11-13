package com.smartparcel.repository;

import com.smartparcel.model.User;
import com.smartparcel.model.UserRole;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    List<User> findByFlatNumber(String flatNumber);
    List<User> findByRole(UserRole role);
}

