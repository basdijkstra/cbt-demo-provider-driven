import {
  CustomerClient,
  CustomerNotFoundError,
  InvalidCustomerIdError,
} from '../src/customerClient';

// The consumer does not write its own mocks or expectations of the provider. It runs against
// the stubs the provider published after verifying its contracts, served by the Spring Cloud
// Contract Stub Runner (docker compose up -d --wait stub-runner).
//
// The stubs only cover the requests described in the provider's contracts. Any other request
// gets WireMock's default 404, so only use the customer IDs from contracts/customers:
// a request for some other ID would "pass" as not found by accident.
const STUB_BASE_URL = process.env.STUB_BASE_URL ?? 'http://localhost:9876';

describe('CustomerClient', () => {
  const client = new CustomerClient(STUB_BASE_URL);

  describe('GET /customers/{id}', () => {
    it('returns the customer when the customer exists', async () => {
      const customer = await client.getCustomer(12345);

      expect(customer.id).toBe(12345);
      expect(customer.name).toBe('Susan Jones');
      expect(customer.status).toBe('ACTIVE');
      expect(customer.address).toEqual({
        street: 'Main Street',
        houseNumber: 15,
        city: 'New York',
        zipCode: 'Y1A 2B3',
      });
    });

    it('throws CustomerNotFoundError when the customer does not exist', async () => {
      await expect(client.getCustomer(99999)).rejects.toBeInstanceOf(CustomerNotFoundError);
    });

    it('throws InvalidCustomerIdError when the customer ID is not an integer', async () => {
      await expect(client.getCustomer('abc')).rejects.toBeInstanceOf(InvalidCustomerIdError);
    });
  });
});
