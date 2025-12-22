package com.yourapp.repository;

import com.yourapp.entity.Transaction;
import com.yourapp.entity.TransactionStatus;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.vertx.RunOnVertxContext;
import io.quarkus.test.vertx. UniAsserter;
import org.junit.jupiter.api.Test;
import javax.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api. Assertions.*;

@QuarkusTest
public class TransactionRepositoryTest {
    
    @Inject
    TransactionRepository repository;
    
    @Test
    @RunOnVertxContext
    public void testFindByUserId(UniAsserter asserter) {
        // Create test transaction
        Transaction tx = new Transaction();
        tx.userId = "testuser";
        tx.action = "Test action";
        tx.amount = new BigDecimal("100.00");
        tx.status = TransactionStatus.PENDING;
        tx.createdBy = "testuser";
        tx.updatedBy = "testuser";
        
        asserter.assertThat(
            () -> tx. persist(),
            persisted -> assertNotNull(persisted.id)
        );
        
        asserter.assertThat(
            () -> repository.findByUserIdPaginated("testuser", 0, 10),
            list -> {
                assertFalse(list.isEmpty());
                assertEquals("testuser", list.get(0).userId);
            }
        );
    }
    
    @Test
    @RunOnVertxContext
    public void testSoftDelete(UniAsserter asserter) {
        Transaction tx = new Transaction();
        tx.userId = "testuser";
        tx.action = "To be deleted";
        tx.amount = new BigDecimal("50.00");
        tx.status = TransactionStatus.PENDING;
        tx.createdBy = "testuser";
        tx.updatedBy = "testuser";
        
        asserter.assertThat(
            () -> tx.persist().chain(t -> t.softDelete()),
            deleted -> assertTrue(deleted.deleted)
        );
        
        // Verify soft-deleted transactions are excluded from normal queries
        asserter.assertThat(
            () -> Transaction.findByUserId("testuser"),
            list -> assertTrue(list.stream().noneMatch(t -> t.deleted))
        );
    }
}