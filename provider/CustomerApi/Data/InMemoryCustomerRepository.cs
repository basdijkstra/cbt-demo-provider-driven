using System.Collections.Concurrent;
using CustomerApi.Models;

namespace CustomerApi.Data;

public class InMemoryCustomerRepository : ICustomerRepository
{
    private readonly ConcurrentDictionary<int, Customer> _customers = new();

    public InMemoryCustomerRepository()
    {
        Add(new Customer(
            Id: 12345,
            Name: "Susan Jones",
            Status: "ACTIVE",
            Address: new Address("Main Street", 15, "New York", "Y1A 2B3"),
            Email: "susan.jones@example.com",
            Phone: "+1-555-555-0123",
            LastModified: new DateTime(2026, 10, 15, 10, 30, 12, DateTimeKind.Utc)));
    }

    public Customer? GetById(int id) => _customers.TryGetValue(id, out var customer) ? customer : null;

    public void Add(Customer customer) => _customers[customer.Id] = customer;

    public void Remove(int id) => _customers.TryRemove(id, out _);
}
