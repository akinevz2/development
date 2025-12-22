package com.yourapp.service;

import com.yourapp.entity.Transaction;
import com.yourapp.entity.TransactionStatus;
import com.yourapp.exception.SecurityException;
import com.yourapp. exception.ValidationException;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test. vertx.RunOnVertxContext;
import io.quarkus.test.vertx.UniAsserter;
import org.junit.jupiter.api.Test;
import javax.inject.Inject;
import java.math.BigDecimal;

import static org.junit.jupiter. api.Assertions.*;

@QuarkusTest
public class TransactionServiceTest {
    
    @Inject
    TransactionService service;
    
    @Test
    @RunOnVertxContext
    public void testCreateTransaction_Success(UniAsserter asserter) {
        Transaction tx = new Transaction();
        tx.userId = "user1";
        tx.action = "Test transaction";
        tx.amount = new BigDecimal("100.00");
        
        asserter.assertThat(
            () -> service.createTransaction(tx, "user1"),
            created -> {
                assertNotNull(created. id);
                assertEquals(TransactionStatus.PENDING, created. status);
                assertEquals("user1", created.createdBy);
            }
        );
    }
    
    @Test
    @RunOnVertxContext
    public void testCreateTransaction_SecurityViolation(UniAsserter asserter) {
        Transaction tx = new Transaction();
        tx.userId = "user2";
        tx.action = "Malicious transaction";
        tx.amount = new BigDecimal("100.00");
        
        // Attempt to create transaction for another user
        asserter.assertFailedWith(
            () -> service.createTransaction(tx, "user1"),
            throwable -> assertTrue(throwable instanceof SecurityException)
        );
    }
    
    @Test
    @RunOnVertxContext
    public void testApproveTransaction_InvalidStateTransition(UniAsserter asserter) {
        // Create and immediately approve
        Transaction tx = new Transaction();
        tx.userId = "user1";
        tx.action = "Test";
        tx.amount = new BigDecimal("100.00");
        
        asserter.assertThat(
            () -> service.createTransaction(tx, "user1")
                .chain(created -> service.approveTransaction(created.id, "operator"))
                .chain(approved -> service.approveTransaction(approved.id, "operator")),
            throwable -> assertTrue(throwable instanceof ValidationException)
        );
    }
}