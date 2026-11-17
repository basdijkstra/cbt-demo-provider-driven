# Provider-driven contract testing with Spring Cloud Contract

A small demo of provider-driven contract testing between a TypeScript consumer and an ASP.NET Core provider,
using the same consumer and provider as the [consumer-driven demo](https://github.com/basdijkstra/cbt-demo-consumer-driven).

In this approach the **provider** writes the contracts. The provider proves its API meets them, and only then publishes
stubs generated from them. Consumers test against those stubs. They do not write their own mocks or expectations.

```
contracts/   Contracts written and owned by the provider (Spring Cloud Contract YAML)
provider/    ASP.NET Core minimal API (CustomerApi), copied as-is from the consumer-driven demo, plus a Dockerfile
consumer/    Node.js + TypeScript client for the Customer API, with Jest tests that run against the provider's stubs
stubs/       Local Maven repository the verified stubs are published to (generated, gitignored)
build/       Spring Cloud Contract build output: generated tests, reports, stubs (generated, gitignored)
```

## How it works

1. **Provider writes the contracts.** `contracts/customers/*.yml` describe concrete interactions: this request gets
   this response. The provider describes everything it promises to return, not just what a particular consumer uses.
2. **Provider verifies its API against them.** The `springcloud/spring-cloud-contract` Docker image generates a test per
   contract and runs it over HTTP against the real, running provider.
3. **Only after a successful verification are the stubs published.** The contracts are turned into WireMock stubs,
   packaged as `customer-api-<version>-stubs.jar` and published to `stubs/`. That folder stands in for an artifact
   repository such as Artifactory or Nexus. If any test fails, nothing is published.
4. **Consumers test against the stubs.** The `springcloud/spring-cloud-contract-stub-runner` image serves the latest
   published stubs on port 9876, and the consumer tests run against that.

All Spring Cloud Contract tooling runs in Docker, so the .NET provider and the TypeScript consumer need no JVM build of
their own.

## The provider

`GET /customers/{id}`

| Situation                     | Response |
|-------------------------------|----------|
| Customer exists               | `200` with customer JSON |
| Customer ID not found         | `404` (problem details) |
| Customer ID is not an integer | `400` (problem details) |

Customer `12345` is seeded in memory. In Docker Compose the API is reachable at `http://localhost:5280`.

## The contracts

| Contract | Request | Response |
|----------|---------|----------|
| `getExistingCustomer.yml`  | `GET /customers/12345` | `200`, the full customer, including `email`, `phone` and `lastModified` |
| `getUnknownCustomer.yml`   | `GET /customers/99999` | `404`, problem details with `title` and `status` |
| `getCustomerInvalidId.yml` | `GET /customers/abc`   | `400`, problem details with `title` and `status` |

All requests must carry `Accept: application/json`. Response values are checked exactly, except `status` (`ACTIVE` or
`INACTIVE`) and `lastModified` (an ISO 8601 UTC timestamp), which are checked against a regex.

Compare this with the consumer-driven demo, where the consumer only asked for `id`, `name`, `status` and `address`.
Here the provider dictates the full response, and has no idea which fields its consumers actually use.

## Where do the contracts come from?

The contracts in this demo were written by hand, one file per interaction. That is how Spring Cloud Contract is normally
used: it has no tool that generates contracts for you. Besides YAML, contracts can be written in a Groovy, Java or
Kotlin DSL.

In a typical provider-side workflow, a developer on the provider team writes a contract for new or changed
behaviour. The build then generates a test from it, which fails until the behaviour is implemented. Once it
passes, the build publishes the stubs. On the JVM, the generated tests extend a base class that sets up the state each
contract needs. In this demo the tests run against the real API instead, so that state (customer `12345`) is seeded in
memory.

**Spring Cloud Contract does not decide who writes the contracts.** The same contract files are used in different
workflows:

| Workflow | Who writes the contracts | Approach |
|----------|--------------------------|----------|
| The provider team writes them in the provider repository (this demo) | Provider | Provider-driven |
| Consumer teams open pull requests on the provider repository, often in a folder per consumer (`contracts/<consumer>/`) | Consumers, reviewed by the provider | Consumer-driven |
| All teams contribute to a central contracts repository the provider pulls from | Shared | Shared |

The workflow that the Spring documentation recommends is actually the consumer-driven one. Participants who have used
Spring Cloud Contract before may know it as a consumer-driven tool, and they are not wrong. This demo is provider-driven
because the provider team writes the contracts, not because the tool requires it. What the tool does dictate is the
format of the contract (concrete interactions), and that stubs are only published after the provider has been verified.

Contracts can also be derived from other sources:

- **Spring REST Docs:** contracts are generated from the provider's existing MockMvc tests. This is the most purely
  provider-driven option, but it is only available to JVM providers.
- **Pact files:** Spring Cloud Contract can read Pact JSON files directly as contracts.
- **OpenAPI:** only through third-party converters, not as part of Spring Cloud Contract itself.

## Prerequisites

- Docker Desktop with Docker Compose
- Node.js 22+

The .NET SDK and Java are not needed: the provider is built inside Docker, and Spring Cloud Contract runs in Docker.

## Before the workshop

Do this once, on the network you prepare on, so the demo does not depend on the workshop Wi-Fi:

```bash
docker compose --profile verify --profile stubs pull contract-tests stub-runner
docker compose build provider
cd consumer
npm install
cd ..
```

Then do a full dry run of the demo script below and finish with [Resetting the demo](#resetting-the-demo).

## Demo script

All commands are run from the repository root unless stated otherwise. They work in both PowerShell and bash.

### Step 1: Show the contracts

Open `contracts/customers/getExistingCustomer.yml`.

- The provider wrote this, not the consumer.
- It is a concrete interaction (request + response), not a schema.
- The response includes everything the provider returns, `email`, `phone` and `lastModified` included.

### Step 2: Verify the provider and publish the stubs

```bash
docker compose run --rm contract-tests
```

This starts the provider, then runs the contract tests against it. It takes about 30-40 seconds. Expect at the end:

```
Results: (3 tests, 3 successes, 0 failures, 0 skipped)
BUILD SUCCESSFUL
```

Then show the results:

- **Generated tests:** `build/contract-tests/generated-test-sources/contractTest/java/contracts/CustomersTest.java`.
  One test per contract, written in Java with REST Assured. Nobody wrote these by hand.
- **Generated stubs:** `build/contract-tests/stubs/META-INF/com.example/customer-api/1.0.0/mappings/customers/`.
  WireMock mappings generated from the same contracts.
- **Published artifact:** `stubs/customer-api/1.0.0/customer-api-1.0.0-stubs.jar`. This is what consumers get.

Point to make: the tests and the stubs come from the same contract, and the stubs are only published after the
tests have passed. Consumers can trust that the stubs behave like the real provider.

### Step 3: Start the stub runner

```bash
docker compose up -d --wait stub-runner
```

This serves the latest published stubs on `http://localhost:9876`. Show that it behaves like the provider:

```bash
curl -i -H "Accept: application/json" http://localhost:9876/customers/12345
curl -i -H "Accept: application/json" http://localhost:9876/customers/99999
```

> In Windows PowerShell 5.1 `curl` is an alias for `Invoke-WebRequest`. Use `curl.exe` instead.

Then show a request that is **not** in the contracts:

```bash
curl -i -H "Accept: application/json" http://localhost:9876/customers/1
```

This also returns `404`, but with `Request was not matched` instead of problem details, and without the
`Matched-Stub-Id` header. The stubs only know the interactions in the contracts. See
[Things to be aware of](#things-to-be-aware-of).

### Step 4: Run the consumer tests

```bash
cd consumer
npm test
cd ..
```

Expect `3 passed`. Open `consumer/test/customerClient.test.ts`: there is no mock setup and no expectation of the
provider anywhere. The test only points the client at the stub runner.

### Step 5: The provider breaks its own contract

Show what happens when the implementation drifts from the contract. In
`provider/CustomerApi/Models/Customer.cs`, rename `ZipCode` to `PostalCode` in the `Address` record:

```csharp
public record Address(string Street, int HouseNumber, string City, string PostalCode);
```

Rebuild the provider and verify it again, as version `1.1.0`:

```bash
docker compose run --rm --build -e PROJECT_VERSION=1.1.0 contract-tests
```

Expect `validate_get_existing_customer() FAILED` with `doesn't match the JSON path [$.['address'][?(@.['zipCode'] == 'Y1A 2B3')]]`,
and `BUILD FAILED`.

Point to make: `stubs/customer-api/` still only contains `1.0.0`. The broken provider published nothing, so consumers
are never handed stubs for behaviour the real API does not have.

### Step 6: The provider changes its contract

Now the provider changes the contract on purpose, to match the new implementation. Keep the `PostalCode` change from
step 5 and, in `contracts/customers/getExistingCustomer.yml`, rename `zipCode` to `postalCode`:

```yaml
    address:
      street: Main Street
      houseNumber: 15
      city: New York
      postalCode: Y1A 2B3
```

Verify again:

```bash
docker compose run --rm --build -e PROJECT_VERSION=1.1.0 contract-tests
```

This passes, and `stubs/customer-api/1.1.0/customer-api-1.1.0-stubs.jar` is published. From the provider's point of
view, everything is fine.

Restart the stub runner so it picks up the latest version, and run the consumer tests again:

```bash
docker compose up -d --wait --force-recreate stub-runner
cd consumer
npm test
cd ..
```

Expect `1 failed, 2 passed`. The diff shows `postalCode` received where `zipCode` was expected.

Point to make: this is the main weakness of provider-driven contract testing. The provider changed its contract
unilaterally, its own pipeline stayed green, and the consumer only found out after the new stubs had been published.
With consumer-driven contract testing, the provider's verification would have failed before the change shipped,
because the consumer's pact says it relies on `zipCode`.

### Step 7: Clean up

Revert both changes, then reset as described below.

## Resetting the demo

1. Revert the `PostalCode` change in `provider/CustomerApi/Models/Customer.cs` and the `postalCode` change in
   `contracts/customers/getExistingCustomer.yml` (for example with `git checkout -- provider contracts`).
2. Stop all containers and delete the generated output:

```bash
# bash
docker compose --profile verify --profile stubs down
rm -rf stubs build
```

```powershell
# PowerShell
docker compose --profile verify --profile stubs down
Remove-Item -Recurse -Force stubs, build
```

3. Run `docker compose build provider` so the next run doesn't start with a rebuild.

## Things to be aware of

- **Unmatched requests return 404.** The stub runner answers every request that is not in the contracts with
  WireMock's default `404`. A consumer test that requests an unknown customer with some other ID (or forgets the
  `Accept` header) passes by accident. Only use the requests from the contracts. A real match carries a
  `Matched-Stub-Id` response header.
- **Broken contract files can be skipped silently.** A YAML syntax problem, such as a backslash escape like `"\."`
  inside a double-quoted string, can make Spring Cloud Contract skip the whole contract without a warning while the
  build stays green. Use single quotes for regexes, and check the test count in the `Results:` line.
- **`iso_date_time` does not accept a trailing `Z`.** The predefined matcher rejects the UTC timestamps .NET emits, so
  `getExistingCustomer.yml` uses its own regex for `lastModified`.
- **Only part of `.m2` is mounted.** The `spring-cloud-contract` image keeps its Gradle plugin in `/home/scc/.m2`.
  Mounting a folder over the whole of `.m2` hides the plugin and breaks the build, so `docker-compose.yml` only mounts
  the `com/example` subfolder.
- **The Docker images are no longer kept up to date.** At the time of writing, the latest images are `4.2.2` and
  `5.0.0-M1` (July 2025), while the Spring Cloud Contract libraries are at `5.0.3`. The images still work, but they
  look like a low priority for the project. JVM teams normally use the Maven or Gradle plugin directly instead.
