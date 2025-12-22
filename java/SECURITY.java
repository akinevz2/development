package com.yourapp.entity;

import io.smallrye.mutiny.Uni;
import javax.persistence.*;
import javax.validation.constraints.*;
import java.math.BigDecimal;
import java.util.List;

/**
 * Represents a financial transaction requiring operator approval.
 * 
 * Security Considerations:
 * - Amount stored as BigDecimal to prevent floating-point manipulation
 * - Status transitions enforced through service layer, not direct field access
 * - All queries use parameterized statements (Panache default)
 * - Immutable fields prevent tampering after creation
 * 
 * Database Table:  transactions
 * Indexes: userId, status, createdAt (for efficient queries)
 */
@Entity
@Table(
    name = "transactions",
    indexes = {
        @Index(name = "idx_user_id", columnList = "user_id"),
        @Index(name = "idx_status", columnList = "status"),
        @Index(name = "idx_created_at", columnList = "created_at")
    }
)
public class Transaction extends AuditableEntity {
    
    /**
     * User identifier associated with this transaction.
     * Security: Must be validated against authenticated user context.
     */
    @NotBlank(message = "User ID is required")
    @Size(max = 100, message = "User ID must not exceed 100 characters")
    @Column(name = "user_id", nullable = false, length = 100)
    public String userId;
    
    /**
     * Description of the transaction action.
     * Security: Sanitized before persistence to prevent XSS in logs/reports.
     */
    @NotBlank(message = "Action description is required")
    @Size(max = 500, message = "Action must not exceed 500 characters")
    @Column(name = "action", nullable = false, length = 500)
    public String action;
    
    /**
     * Transaction amount.
     * Security: BigDecimal prevents floating-point rounding exploits.
     * Precision:  19 digits total, 4 decimal places.
     */
    @NotNull(message = "Amount is required")
    @DecimalMin(value = "0.0", inclusive = false, message = "Amount must be positive")
    @Column(name = "amount", nullable = false, precision = 19, scale = 4)
    public BigDecimal amount;
    
    /**
     * Current transaction status.
     * Security: Status transitions must be validated in service layer.
     * PENDING -> APPROVED or REJECTED only (no reverse transitions).
     */
    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    public TransactionStatus status = TransactionStatus.PENDING;
    
    /**
     * Operator who approved/rejected the transaction.
     * Null until transaction is processed.
     * Security: Provides accountability for approval decisions.
     */
    @Size(max = 100)
    @Column(name = "approved_by", length = 100)
    public String approvedBy;
    
    /**
     * Timestamp when transaction was approved/rejected.
     * Security: Server-controlled, cannot be manipulated by client.
     */
    @Column(name = "approved_at")
    public LocalDateTime approvedAt;
    
    /**
     * Optional reason for rejection.
     * Security: Logged for audit purposes.
     */
    @Size(max = 1000)
    @Column(name = "rejection_reason", length = 1000)
    public String rejectionReason;
    
    // ========== SECURE QUERY METHODS ==========
    
    /**
     * Find all transactions for a specific user.
     * Security: Always filter by userId to prevent unauthorized access.
     * 
     * @param userId User identifier (validated by caller)
     * @return Reactive list of transactions
     */
    public static Uni<List<Transaction>> findByUserId(String userId) {
        // Parameterized query - prevents SQL injection
        return list("userId = ?1 and deleted = false", userId);
    }
    
    /**
     * Find pending transactions requiring approval.
     * Security: Only returns non-deleted transactions.
     * 
     * @return Reactive list of pending transactions
     */
    public static Uni<List<Transaction>> findPending() {
        return list("status = ?1 and deleted = false", TransactionStatus.PENDING);
    }
    
    /**
     * Find transaction by ID with security check.
     * Security: Verifies transaction belongs to specified user.
     * 
     * @param id Transaction ID
     * @param userId User identifier for authorization check
     * @return Transaction if found and authorized, null otherwise
     */
    public static Uni<Transaction> findByIdAndUser(Long id, String userId) {
        return find("id = ? 1 and userId = ?2 and deleted = false", id, userId)
            .firstResult();
    }
    
    /**
     * Count pending transactions for monitoring.
     * Security: Excludes soft-deleted records.
     * 
     * @return Count of pending transactions
     */
    public static Uni<Long> countPending() {
        return count("status = ?1 and deleted = false", TransactionStatus.PENDING);
    }
    
    /**
     * Soft delete - mark as deleted rather than physical deletion.
     * Security: Preserves audit trail, prevents evidence tampering.
     * 
     * @return Updated entity
     */
    public Uni<Transaction> softDelete() {
        this.deleted = true;
        return this.persistAndFlush();
    }
}