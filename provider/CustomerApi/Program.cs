using CustomerApi.Data;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ICustomerRepository, InMemoryCustomerRepository>();

var app = builder.Build();

// The route parameter is deliberately unconstrained (no {id:int}), so that a
// non-integer ID is answered with a 400 instead of falling through to a 404.
app.MapGet("/customers/{id}", (string id, ICustomerRepository repository) =>
{
    if (!int.TryParse(id, out var customerId))
    {
        return Results.Problem(
            statusCode: StatusCodes.Status400BadRequest,
            title: "Invalid customer ID",
            detail: $"Customer ID '{id}' is not an integer.");
    }

    var customer = repository.GetById(customerId);

    return customer is null
        ? Results.Problem(
            statusCode: StatusCodes.Status404NotFound,
            title: "Customer not found",
            detail: $"Customer with ID {customerId} was not found.")
        : Results.Ok(customer);
});

app.Run();

// Exposes the entry point to WebApplicationFactory in the test project.
public partial class Program;
