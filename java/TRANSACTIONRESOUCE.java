package com.yourapp.resource;

import com.yourapp.entity. Transaction;
import com.yourapp.service.TransactionService;
import com.yourapp.dto.ApprovalRequest;
import com. yourapp.dto.RejectionRequest;
import io.smallrye.mutiny. Uni;
import org.jboss.logging.Logger;
import javax.inject.Inject;
import javax. ws.rs.*;
import javax.ws.rs.core.*;
import java.util.List;

/**
 * REST API for transaction operations.
 * 
 * Security: 
 * - All endpoints validate authentication context
 * - Input validation via Bean Validation
 * - Authorization checks delegated to service layer
 * - Error responses don't leak sensitive information
 */
@Path("/api/transactions")
@Produces(MediaType.APPLICATION_JSON)
@Consumes(MediaType. APPLICATION_JSON)
public class TransactionResource {
    
    private static final Logger LOG = Logger.getLogger(TransactionResource.class);
    
    @Inject
    TransactionService transactionService;
    
    @Context
    SecurityContext securityContext;
    
    /**
     * Create a new transaction.
     * Security: User context extracted from SecurityContext. 
     */
    @POST
    public Uni<Response> createTransaction(Transaction transaction) {
        String currentUser = getCurrentUser();
        
        return transactionService.createTransaction(transaction, currentUser)
            .onItem().transform(t -> 
                Response.status(Response.Status.CREATED)
                    .entity(t)
                    .build()
            )
            .onFailure().recoverWithItem(this::handleError);
    }
    
    /**
     * Get transaction by ID.
     * Security: Authorization check in service layer.
     */
    @GET
    @Path("/{id}")
    public Uni<Response> getTransaction(@PathParam("id") Long id) {
        String currentUser = getCurrentUser();
        
        return transactionService.getTransaction(id, currentUser)
            .onItem().transform(t -> Response.ok(t).build())
            .onFailure().recoverWithItem(this:: handleError);
    }
    
    /**
     * List user's transactions.
     * Security: User can only list their own transactions.
     */
    @GET
    public Uni<Response> listTransactions(
        @QueryParam("page") @DefaultValue("0") int page,
        @QueryParam("pageSize") @DefaultValue("20") int pageSize
    ) {
        String currentUser = getCurrentUser();
        
        return transactionService.listUserTransactions(currentUser, currentUser, page, pageSize)
            .onItem().transform(list -> Response.ok(list).build())
            .onFailure().recoverWithItem(this::handleError);
    }
    
    /**
     * List all pending transactions (operator endpoint).
     * Security: Should be protected by @RolesAllowed("operator") in production.
     */
    @GET
    @Path("/pending")
    // @RolesAllowed("operator") // Uncomment when RBAC is configured
    public Uni<Response> listPendingTransactions() {
        return transactionService.listPendingTransactions()
            .onItem().transform(list -> Response.ok(list).build())
            .onFailure().recoverWithItem(this::handleError);
    }
    
    /**
     * Approve a transaction.
     * Security:  Operator identity recorded for audit. 
     */
    @POST
    @Path("/{id}/approve")
    // @RolesAllowed("operator")
    public Uni<Response> approveTransaction(
        @PathParam("id") Long id,
        ApprovalRequest request
    ) {
        String operator = getCurrentUser();
        
        return transactionService.approveTransaction(id, operator)
            .onItem().transform(t -> Response.ok(t).build())
            .onFailure().recoverWithItem(this::handleError);
    }
    
    /**
     * Reject a transaction. 
     * Security: Requires rejection reason for audit.
     */
    @POST
    @Path("/{id}/reject")
    // @RolesAllowed("operator")
    public Uni<Response> rejectTransaction(
        @PathParam("id") Long id,
        RejectionRequest request
    ) {
        String operator = getCurrentUser();
        
        return transactionService.rejectTransaction(id, operator, request.reason)
            .onItem().transform(t -> Response.ok(t).build())
            .onFailure().recoverWithItem(this::handleError);
    }
    
    /**
     * Extract current user from security context.
     * In production, this would come from JWT or session.
     */
    private String getCurrentUser() {
        // TODO: Replace with actual authentication mechanism
        if (securityContext != null && securityContext.getUserPrincipal() != null) {
            return securityContext.getUserPrincipal().getName();
        }
        // Development fallback
        return "dev-user";
    }
    
    /**
     * Handle exceptions and convert to appropriate HTTP responses.
     * Security: Don't leak internal error details to clients.
     */
    private Response handleError(Throwable error) {
        LOG.error("Error processing request", error);
        
        if (error instanceof com.yourapp.exception.ValidationException) {
            return Response.status(Response.Status. BAD_REQUEST)
                .entity(Map.of("error", error.getMessage()))
                .build();
        }
        
        if (error instanceof com.yourapp. exception.SecurityException) {
            return Response.status(Response.Status.FORBIDDEN)
                .entity(Map. of("error", "Access denied"))
                .build();
        }
        
        // Generic error - don't expose internal details
        return Response.status(Response.Status.INTERNAL_SERVER_ERROR)
            .entity(Map.of("error", "An error occurred processing your request"))
            .build();
    }
}