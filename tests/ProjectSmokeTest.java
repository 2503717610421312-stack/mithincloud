import java.net.Proxy;
import java.net.ProxySelector;
import java.net.SocketAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;

public final class ProjectSmokeTest {
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .version(HttpClient.Version.HTTP_1_1)
            .proxy(new ProxySelector() {
                @Override
                public List<Proxy> select(URI uri) {
                    return List.of(Proxy.NO_PROXY);
                }

                @Override
                public void connectFailed(URI uri, SocketAddress address, java.io.IOException error) {}
            })
            .followRedirects(HttpClient.Redirect.NORMAL)
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    private static String baseUrl;
    private static int passed;
    private static int failed;

    private ProjectSmokeTest() {}

    public static void main(String[] args) {
        baseUrl = args.length == 0 ? "http://localhost:3000" : args[0];
        while (baseUrl.endsWith("/")) {
            baseUrl = baseUrl.substring(0, baseUrl.length() - 1);
        }

        check("Home redirects to login", request("GET", "/", null), 200, null, "/login");
        check("Dashboard redirects to login without a session", request("GET", "/dashboard", null), 200, null, "/login");
        check("Login page loads", request("GET", "/login", null), 200, "Sign in to the portal", null);
        check("Registration page loads", request("GET", "/register", null), 200, "Create your account", null);

        check("Paper list rejects anonymous access", request("GET", "/api/papers", null), 401, "Unauthorized", null);
        check("Paper creation rejects anonymous access", request("POST", "/api/papers", "{}"), 401, "Unauthorized", null);
        check("Audit log rejects anonymous access", request("GET", "/api/audit", null), 401, "Unauthorized", null);

        String paperId = "00000000-0000-0000-0000-000000000001";
        check("Paper decryption rejects anonymous access",
                request("POST", "/api/papers/" + paperId + "/decrypt", "{}"), 401, "Unauthorized", null);
        check("Print authorization rejects anonymous access",
                request("POST", "/api/papers/" + paperId + "/print", "{}"), 401, "Unauthorized", null);

        check("Registration rejects malformed JSON",
                request("POST", "/api/register", "{"), 400, "Enter a valid name", null);
        check("Registration rejects missing fields",
                request("POST", "/api/register", "{\"fullName\":\"\",\"email\":\"\",\"password\":\"\"}"),
                400, "Enter a valid name", null);

        System.out.printf("%nResults: %d passed, %d failed%n", passed, failed);
        if (failed > 0) {
            System.exit(1);
        }
    }

    private static HttpRequest request(String method, String path, String body) {
        HttpRequest.Builder builder = HttpRequest.newBuilder()
                .uri(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(20));

        if (body == null) {
            builder.method(method, HttpRequest.BodyPublishers.noBody());
        } else {
            builder.header("Content-Type", "application/json")
                    .method(method, HttpRequest.BodyPublishers.ofString(body));
        }
        return builder.build();
    }

    private static void check(String name, HttpRequest request, int expectedStatus,
                              String expectedBody, String expectedPath) {
        try {
            HttpResponse<String> response = CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
            boolean success = response.statusCode() == expectedStatus;
            if (expectedBody != null) {
                success &= response.body().contains(expectedBody);
            }
            if (expectedPath != null) {
                success &= response.uri().getPath().equals(expectedPath);
            }

            if (success) {
                passed++;
                System.out.println("PASS " + name);
            } else {
                failed++;
                System.out.printf("FAIL %s (HTTP %d, final path %s)%n",
                        name, response.statusCode(), response.uri().getPath());
            }
        } catch (Exception error) {
            failed++;
            System.out.println("FAIL " + name + " (" + error.getClass().getSimpleName()
                    + ": " + error.getMessage() + ")");
        }
    }
}