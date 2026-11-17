namespace CustomerApi.Models;

public record Address(string Street, int HouseNumber, string City, string ZipCode);

public record Customer(
    int Id,
    string Name,
    string Status,
    Address Address,
    string Email,
    string Phone,
    DateTime LastModified);
