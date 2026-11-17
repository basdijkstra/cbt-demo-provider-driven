export interface Address {
  street: string;
  houseNumber: number;
  city: string;
  zipCode: string;
}

export interface Customer {
  id: number;
  name: string;
  status: string;
  address: Address;
  email: string;
  phone: string;
  lastModified: string;
}

export class CustomerNotFoundError extends Error {
  constructor(id: number | string) {
    super(`Customer with ID ${id} was not found`);
    this.name = 'CustomerNotFoundError';
  }
}

export class InvalidCustomerIdError extends Error {
  constructor(id: number | string) {
    super(`Customer ID '${id}' is not valid`);
    this.name = 'InvalidCustomerIdError';
  }
}

export class CustomerClient {
  constructor(private readonly baseUrl: string) {}

  /**
   * Retrieves a customer by ID. The ID type is deliberately loose so callers
   * can pass through unvalidated input; the provider rejects non-integers.
   */
  async getCustomer(id: number | string): Promise<Customer> {
    const url = `${this.baseUrl}/customers/${encodeURIComponent(String(id))}`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    switch (response.status) {
      case 200:
        return (await response.json()) as Customer;
      case 400:
        throw new InvalidCustomerIdError(id);
      case 404:
        throw new CustomerNotFoundError(id);
      default:
        throw new Error(`Unexpected response from Customer API: HTTP ${response.status}`);
    }
  }
}
