package com.yourapp.service;

import com.yourapp.entity.Transaction;
import org.jboss.logging.Logger;
import javax.enterprise.context.ApplicationScoped;

/**
 * Centralized audit logging service.
 * 
 * Security: All security-relevant events are logged here.
 * Logs are written to Quarkus console for operator monitoring.
 */
@ApplicationScoped
public class AuditLogService {
    
    private static final Logger LOG = Logger.getLogger("AUDIT");
    
    public void logTransactionCreated(Transaction transaction) {
        LOG.infof("[CREATE] Transaction id=%d user=%s amount=%s action='%s'",
            transaction. id, transaction.userId, transaction. amount, 
            sanitize(transaction.action));
    }
    
    public void logTransactionApproved(Transaction transaction, String operator) {
        LOG.infof("[APPROVE] Transaction id=%d user=%s operator=%s amount=%s",
            transaction.id, transaction. userId, operator, transaction.amount);
    }
    
    public void logTransactionRejected(Transaction transaction, String operator, String reason) {
        LOG.infof("[REJECT] Transaction id=%d user=%s operator=%s reason='%s'",
            transaction.id, transaction.userId, operator, sanitize(reason));
    }
    
    public void logSecurityViolation(String event, String user, String details) {
        LOG.warnf("[SECURITY] event='%s' user=%s details='%s'",
            sanitize(event), user, sanitize(details));
    }
    
    /**
     * Sanitize strings for logging to prevent log injection attacks.
     * Removes newlines and control characters.
     */
    private String sanitize(String input) {
        if (input == null) return "";
        return input.replaceAll("[\\r\\n]", " ")
                   .replaceAll("[\\p{Cntrl}]", "");
    }
}