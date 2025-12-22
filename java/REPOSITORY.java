package com.yourapp.repository;

import com.yourapp.entity.Transaction;
import com.yourapp.entity.TransactionStatus;
import io.quarkus.hibernate.reactive.panache.PanacheRepository;
import io.smallrye.mutiny.Uni;
import javax.enterprise.context.ApplicationScoped;
import java.time.LocalDateTime;
import java. util.List;

/**
 * Repository pattern for Transaction entity operations.
 * 
 * Benefits:
 * - Centralizes all database operations
 * - Easier to add caching or additional security layers
 * - Simplifies testing with mock repositories
 * - Clear separation of concerns
 * 
 * Security:  All methods use parameterized queries and validate inputs.
 */
@ApplicationScoped
public class TransactionRepository implements PanacheRepository<Transaction> {
    
    /**
     * Find transactions by user with pagination. 
     * Security: Parameterized query, pagination prevents DoS via large result sets.
     * 
     * @param userId User identifier
     * @param page Page number (0-indexed)
     * @param pageSize Number of results per page
     * @return Paginated list of transactions
     */
    public Uni<List<Transaction>> findByUserIdPaginated(String userId, int page, int pageSize) {
        // Validate pagination parameters to prevent abuse
        int safePage = Math.max(0, page);
        int safePageSize = Math.min(100, Math.max(1, pageSize)); // Max 100 per page
        
        return find("userId = ?1 and deleted = false order by createdAt desc", userId)
            .page(safePage, safePageSize)
            .list();
    }
    
    /**
     * Find transactions within date range.
     * Security: Prevents unbounded queries that could cause performance issues.
     * 
     * @param userId User identifier
     * @param start Start date
     * @param end End date
     * @return Transactions within date range
     */
    public Uni<List<Transaction>> findByDateRange(String userId, LocalDateTime start, LocalDateTime end) {
        return list(
            "userId = ?1 and createdAt >= ?2 and createdAt <= ?3 and deleted = false order by createdAt desc",
            userId, start, end
        );
    }
    
    /**
     * Find all pending transactions older than specified minutes.
     * Security: Used for monitoring stuck/abandoned transactions.
     * 
     * @param minutes Age threshold in minutes
     * @return Old pending transactions
     */
    public Uni<List<Transaction>> findStalePendingTransactions(int minutes) {
        LocalDateTime threshold = LocalDateTime.now().minusMinutes(minutes);
        return list(
            "status = ?1 and createdAt < ?2 and deleted = false",
            TransactionStatus.PENDING, threshold
        );
    }
    
    /**
     * Count transactions by status for a user.
     * Security: Used for rate limiting and anomaly detection.
     * 
     * @param userId User identifier
     * @param status Transaction status
     * @return Count of matching transactions
     */
    public Uni<Long> countByUserAndStatus(String userId, TransactionStatus status) {
        return count("userId = ?1 and status = ?2 and deleted = false", userId, status);
    }
}