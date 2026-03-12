package ac.uk.sussex.kn253.service;

import java.time.Duration;
import java.time.Instant;

import ac.uk.sussex.kn253.model.Timetable;
import ac.uk.sussex.kn253.repository.TimetableRepository;
import io.smallrye.jwt.auth.principal.JWTParser;
import io.smallrye.jwt.build.Jwt;
import io.smallrye.jwt.build.JwtClaimsBuilder;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

@ApplicationScoped
public class AuthService {

    @Inject
    TimetableRepository timetableRepository;

    @Inject
    SessionService sessionService;

    @Inject
    JWTParser jwtParser;

    public String generateToken(final String timetableName) {
        // Check whether there is already a session for timetable
        final Timetable timetable = timetableRepository.findByName(timetableName);

        // If timetable already exists, reject generation attempt
        if (timetable != null) {
            throw new IllegalArgumentException("Timetable already exists");
        }

        // Create JWT claims with the timetable name as the subject and a 24-hour
        // expiration time
        final JwtClaimsBuilder claims = Jwt.issuer("timetable-app")
                .subject(timetableName)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plus(Duration.ofHours(24)));

        return claims.sign();
    }

    public String extendToken(final String timetableName, final String token) {
        // Check whether there is already a session for timetable
        if (!validateToken(token)) {
            throw new IllegalArgumentException("Invalid token");
        }
        final JwtClaimsBuilder claims = Jwt.issuer("timetable-app")
                .subject(timetableName)
                .issuedAt(Instant.now())
                .expiresAt(Instant.now().plus(Duration.ofHours(24)));
        return claims.sign();
    }

    public boolean validateToken(final String token) {
        try {
            // Parse the token to validate it
            final var parsedToken = jwtParser.parse(token);
            // Check the tokens expiration time and subject
            final var subject = parsedToken.getSubject();
            final var timetable = timetableRepository.findByName(subject);
            if (timetable == null) {
                return false;
            }
            final var expirationTime = Instant.ofEpochMilli(parsedToken.getExpirationTime());
            if (expirationTime == null || expirationTime.isBefore(Instant.now())) {
                return false;
            }
            return true;
        } catch (final Exception e) {
            return false;
        }
    }

}