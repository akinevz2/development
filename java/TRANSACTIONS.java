package com.yourapp.service;

import com.yourapp.entity.Transaction;
import com.yourapp. entity.TransactionStatus;
import com.yourapp.repository.TransactionRepository;
import com.yourapp.exception.SecurityException;
import com.yourapp.exception.ValidationException;
import io.smallrye.mutiny. Uni;
import org.jboss.logging.Logger;
import javax.enterprise.context.ApplicationScoped;
import javax.inject.Inject;
import javax. transaction.Transactional;
import javax.validation.Valid;
import javax.validation. Validator;
import java.time.LocalDateTime;
import java. util.List;
import java. util.Set;

/**
 * Business logic layer for transaction operations.
 * 
 * Security Features:
 * - Input validation using Bean Validation
 * - Authorization checks (user owns transaction)
 * - State machine enforcement (valid status transitions)
 * - Audit logging for all operations
 * - Rate limiting hooks
 * - Sensitive data sanitization
 */
@ApplicationScoped
public class TransactionService {
    
    private static final Logger LOG = Logger.getLogger(TransactionService.class);
    
    @Inject
    TransactionRepository repository;
    
    @Inject
    Validator validator;
    
    @Inject
    AuditLogService auditLog;
    
    /**
     * Create a new transaction. 
     * Security: 
     * - Validates input data
     * - Sets audit fields server-side
     * - Checks rate limits
     * - Logs creation for audit trail
     * 
     * @param transaction Transaction to create (validated)
     * @param currentUser Authenticated user context
     * @return Persisted transaction
     */
    @Transactional
    public Uni<Transaction> createTransaction(@Valid Transaction transaction, String currentUser) {
        // Validate input
        Set<javax.validation. ConstraintViolation<Transaction>> violations = validator.validate(transaction);
        if (!violations.isEmpty()) {
            String errors = violations.stream()
                .map(v -> v.getPropertyPath() + ": " + v.getMessage())
                .reduce((a, b) -> a + ", " + b)
                .orElse("Validation failed");
            return Uni.createFrom().failure(new ValidationException(errors));
        }
        
        // Security:  Verify user is creating transaction for themselves
        if (!transaction.userId.equals(currentUser)) {
            LOG.warnf("Security violation: User %s attempted to create transaction for %s", 
                currentUser, transaction.userId);
            return Uni.createFrom().failure(
                new SecurityException("Cannot create transaction for another user")
            );
        }
        
        // Check rate limit (example: max 10 pending transactions per user)
        return repository.countByUserAndStatus(currentUser, TransactionStatus.PENDING)
            .onItem().transformToUni(count -> {
                if (count >= 10) {
                    LOG.warnf("Rate limit exceeded:  User %s has %d pending transactions", currentUser, count);
                    return Uni.createFrom().failure(
                        new ValidationException("Too many pending transactions.  Maximum:  10")
                    );
                }
                
                // Set audit fields
                transaction.createdBy = currentUser;
                transaction. updatedBy = currentUser;
                transaction.status = TransactionStatus.PENDING;
                
                // Persist
                return transaction.persistAndFlush()
                    .onItem().invoke(t -> {
                        LOG.infof("Transaction created: id=%d, user=%s, amount=%s", 
                            t.id, t.userId, t.amount);
                        auditLog. logTransactionCreated(t);
                    });
            });
    }
    
    /**
     * Approve a transaction.
     * Security:
     * - Validates state transition (PENDING -> APPROVED only)
     * - Records operator identity
     * - Immutable after approval
     * - Full audit logging
     * 
     * @param transactionId Transaction ID to approve
     * @param operator Operator performing approval
     * @return Approved transaction
     */
    @Transactional
    public Uni<Transaction> approveTransaction(Long transactionId, String operator) {
        return Transaction. <Transaction>findById(transactionId)
            .onItem().ifNull().failWith(() -> {
                LOG.warnf("Approval attempted on non-existent transaction: id=%d", transactionId);
                return new ValidationException("Transaction not found");
            })
            .onItem().transformToUni(tx -> {
                // Security: Verify current status allows approval
                if (tx.status != TransactionStatus.PENDING) {
                    LOG.warnf("Invalid state transition: Transaction %d is %s, cannot approve", 
                        tx.id, tx.status);
                    return Uni.createFrom().failure(
                        new ValidationException("Only PENDING transactions can be approved")
                    );
                }
                
                // Security: Check if transaction is deleted (soft delete)
                if (tx.deleted) {
                    LOG.warnf("Approval attempted on deleted transaction: id=%d", transactionId);
                    return Uni.createFrom().failure(
                        new ValidationException("Cannot approve deleted transaction")
                    );
                }
                
                // Update transaction
                tx.status = TransactionStatus.APPROVED;
                tx.approvedBy = operator;
                tx.approvedAt = LocalDateTime.now();
                tx.updatedBy = operator;
                
                return tx.persistAndFlush()
                    .onItem().invoke(t -> {
                        LOG. infof("Transaction approved: id=%d, operator=%s, user=%s, amount=%s",
                            t.id, operator, t.userId, t.amount);
                        auditLog. logTransactionApproved(t, operator);
                    });
            });
    }
    
    /**
     * Reject a transaction with reason.
     * Security:
     * - Validates state transition (PENDING -> REJECTED only)
     * - Requires rejection reason for audit
     * - Immutable after rejection
     * 
     * @param transactionId Transaction ID to reject
     * @param operator Operator performing rejection
     * @param reason Rejection reason (required for audit)
     * @return Rejected transaction
     */
    @Transactional
    public Uni<Transaction> rejectTransaction(Long transactionId, String operator, String reason) {
        // Validate reason is provided
        if (reason == null || reason.trim().isEmpty()) {
            return Uni.createFrom().failure(
                new ValidationException("Rejection reason is required")
            );
        }
        
        return Transaction. <Transaction>findById(transactionId)
            .onItem().ifNull().failWith(() -> 
                new ValidationException("Transaction not found")
            )
            .onItem().transformToUni(tx -> {
                // Security:  Verify current status allows rejection
                if (tx.status != TransactionStatus.PENDING) {
                    LOG.warnf("Invalid state transition: Transaction %d is %s, cannot reject", 
                        tx.id, tx.status);
                    return Uni. createFrom().failure(
                        new ValidationException("Only PENDING transactions can be rejected")
                    );
                }
                
                if (tx.deleted) {
                    return Uni.createFrom().failure(
                        new ValidationException("Cannot reject deleted transaction")
                    );
                }
                
                // Update transaction
                tx.status = TransactionStatus.REJECTED;
                tx.approvedBy = operator;
                tx.approvedAt = LocalDateTime. now();
                tx.rejectionReason = reason;
                tx.updatedBy = operator;
                
                return tx.persistAndFlush()
                    .onItem().invoke(t -> {
                        LOG.infof("Transaction rejected: id=%d, operator=%s, reason=%s",
                            t. id, operator, reason);
                        auditLog.logTransactionRejected(t, operator, reason);
                    });
            });
    }
    
    /**
     * Get transaction by ID with authorization check.
     * Security: Ensures user can only access their own transactions.
     * 
     * @param transactionId Transaction ID
     * @param currentUser Authenticated user
     * @return Transaction if authorized
     */
    public Uni<Transaction> getTransaction(Long transactionId, String currentUser) {
        return Transaction. findByIdAndUser(transactionId, currentUser)
            .onItem().ifNull().failWith(() -> {
                // Log potential unauthorized access attempt
                LOG.warnf("Unauthorized access attempt: user=%s, transactionId=%d", 
                    currentUser, transactionId);
                return new SecurityException("Transaction not found or access denied");
            });
    }
    
    /**
     * List user's transactions with pagination.
     * Security: User can only see their own transactions.
     * 
     * @param userId User identifier (must match authenticated user)
     * @param currentUser Authenticated user
     * @param page Page number
     * @param pageSize Page size
     * @return Paginated transaction list
     */
    public Uni<List<Transaction>> listUserTransactions(
        String userId, 
        String currentUser, 
        int page, 
        int pageSize
    ) {
        // Security: User can only list their own transactions
        if (!userId.equals(currentUser)) {
            LOG.warnf("Authorization violation: User %s attempted to list transactions for %s",
                currentUser, userId);
            return Uni.createFrom().failure(
                new SecurityException("Cannot access another user's transactions")
            );
        }
        
        return repository.findByUserIdPaginated(userId, page, pageSize);
    }
    
    /**
     * Get all pending transactions (operator only).
     * Security: Should be protected by role-based access control in REST layer.
     * 
     * @return List of pending transactions
     */
    public Uni<List<Transaction>> listPendingTransactions() {
        return Transaction.findPending();
    }
}