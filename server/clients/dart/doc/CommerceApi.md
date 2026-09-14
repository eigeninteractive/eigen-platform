# eigen_api.api.CommerceApi

## Load the API package
```dart
import 'package:eigen_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**claimCommercePurchase**](CommerceApi.md#claimcommercepurchase) | **POST** /api/engine/commerce/claims | 
[**createCommerceCheckout**](CommerceApi.md#createcommercecheckout) | **POST** /api/engine/commerce/checkout | 
[**createCommerceManagement**](CommerceApi.md#createcommercemanagement) | **POST** /api/engine/commerce/management | 
[**getCommerceAccess**](CommerceApi.md#getcommerceaccess) | **GET** /api/engine/commerce/access | 
[**getCommerceCatalog**](CommerceApi.md#getcommercecatalog) | **GET** /api/engine/commerce/catalog | 
[**restoreCommercePurchases**](CommerceApi.md#restorecommercepurchases) | **POST** /api/engine/commerce/restore | 


# **claimCommercePurchase**
> AccessSnapshot claimCommercePurchase(commerceClaim)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getCommerceApi();
final CommerceClaim commerceClaim = ; // CommerceClaim | 

try {
    final response = api.claimCommercePurchase(commerceClaim);
    print(response);
} catch on DioException (e) {
    print('Exception when calling CommerceApi->claimCommercePurchase: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commerceClaim** | [**CommerceClaim**](CommerceClaim.md)|  | 

### Return type

[**AccessSnapshot**](AccessSnapshot.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createCommerceCheckout**
> CommerceUrl createCommerceCheckout(commerceCheckoutRequest)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getCommerceApi();
final CommerceCheckoutRequest commerceCheckoutRequest = ; // CommerceCheckoutRequest | 

try {
    final response = api.createCommerceCheckout(commerceCheckoutRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling CommerceApi->createCommerceCheckout: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commerceCheckoutRequest** | [**CommerceCheckoutRequest**](CommerceCheckoutRequest.md)|  | 

### Return type

[**CommerceUrl**](CommerceUrl.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **createCommerceManagement**
> CommerceUrl createCommerceManagement(commerceManagementRequest)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getCommerceApi();
final CommerceManagementRequest commerceManagementRequest = ; // CommerceManagementRequest | 

try {
    final response = api.createCommerceManagement(commerceManagementRequest);
    print(response);
} catch on DioException (e) {
    print('Exception when calling CommerceApi->createCommerceManagement: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commerceManagementRequest** | [**CommerceManagementRequest**](CommerceManagementRequest.md)|  | 

### Return type

[**CommerceUrl**](CommerceUrl.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getCommerceAccess**
> AccessSnapshot getCommerceAccess()



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getCommerceApi();

try {
    final response = api.getCommerceAccess();
    print(response);
} catch on DioException (e) {
    print('Exception when calling CommerceApi->getCommerceAccess: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**AccessSnapshot**](AccessSnapshot.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getCommerceCatalog**
> CommerceCatalog getCommerceCatalog()



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getCommerceApi();

try {
    final response = api.getCommerceCatalog();
    print(response);
} catch on DioException (e) {
    print('Exception when calling CommerceApi->getCommerceCatalog: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**CommerceCatalog**](CommerceCatalog.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **restoreCommercePurchases**
> AccessSnapshot restoreCommercePurchases(commerceRestore)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getCommerceApi();
final CommerceRestore commerceRestore = ; // CommerceRestore | 

try {
    final response = api.restoreCommercePurchases(commerceRestore);
    print(response);
} catch on DioException (e) {
    print('Exception when calling CommerceApi->restoreCommercePurchases: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **commerceRestore** | [**CommerceRestore**](CommerceRestore.md)|  | 

### Return type

[**AccessSnapshot**](AccessSnapshot.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

