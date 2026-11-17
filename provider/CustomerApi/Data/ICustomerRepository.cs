using CustomerApi.Models;

namespace CustomerApi.Data;

public interface ICustomerRepository
{
    Customer? GetById(int id);

    void Add(Customer customer);

    void Remove(int id);
}
