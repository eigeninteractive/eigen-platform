# eigen_api.api.MeApi

## Load the API package
```dart
import 'package:eigen_api/api.dart';
```

All URIs are relative to *http://localhost*

Method | HTTP request | Description
------------- | ------------- | -------------
[**deleteAccount**](MeApi.md#deleteaccount) | **DELETE** /api/engine/me | 
[**getMyFinishedGames**](MeApi.md#getmyfinishedgames) | **GET** /api/engine/me/games/finished | 
[**getProfile**](MeApi.md#getprofile) | **GET** /api/engine/me | 
[**registerDevice**](MeApi.md#registerdevice) | **PUT** /api/engine/me/devices | 
[**syncAccount**](MeApi.md#syncaccount) | **GET** /api/engine/me/sync | 
[**unregisterDevice**](MeApi.md#unregisterdevice) | **DELETE** /api/engine/me/devices/{fid} | 
[**updateDisplayName**](MeApi.md#updatedisplayname) | **PUT** /api/engine/me/display-name | 
[**updateUsername**](MeApi.md#updateusername) | **PUT** /api/engine/me/username | 


# **deleteAccount**
> deleteAccount()



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getMeApi();

try {
    api.deleteAccount();
} catch on DioException (e) {
    print('Exception when calling MeApi->deleteAccount: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

void (empty response body)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getMyFinishedGames**
> MyFinishedGames getMyFinishedGames(limit, cursor)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getMeApi();
final int limit = 56; // int | 
final String cursor = cursor_example; // String | 

try {
    final response = api.getMyFinishedGames(limit, cursor);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->getMyFinishedGames: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **limit** | **int**|  | [optional] [default to 20]
 **cursor** | **String**|  | [optional] 

### Return type

[**MyFinishedGames**](MyFinishedGames.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **getProfile**
> Profile getProfile()



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getMeApi();

try {
    final response = api.getProfile();
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->getProfile: $e\n');
}
```

### Parameters
This endpoint does not need any parameter.

### Return type

[**Profile**](Profile.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **registerDevice**
> registerDevice(deviceRegistration)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getMeApi();
final DeviceRegistration deviceRegistration = ; // DeviceRegistration | 

try {
    api.registerDevice(deviceRegistration);
} catch on DioException (e) {
    print('Exception when calling MeApi->registerDevice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **deviceRegistration** | [**DeviceRegistration**](DeviceRegistration.md)|  | 

### Return type

void (empty response body)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **syncAccount**
> AccountSync syncAccount(finishedAfter)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getMeApi();
final int finishedAfter = 56; // int | 

try {
    final response = api.syncAccount(finishedAfter);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->syncAccount: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **finishedAfter** | **int**|  | [optional] 

### Return type

[**AccountSync**](AccountSync.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **unregisterDevice**
> unregisterDevice(fid)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getMeApi();
final String fid = fid_example; // String | 

try {
    api.unregisterDevice(fid);
} catch on DioException (e) {
    print('Exception when calling MeApi->unregisterDevice: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **fid** | **String**|  | 

### Return type

void (empty response body)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateDisplayName**
> Profile updateDisplayName(displayNameUpdate)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getMeApi();
final DisplayNameUpdate displayNameUpdate = ; // DisplayNameUpdate | 

try {
    final response = api.updateDisplayName(displayNameUpdate);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->updateDisplayName: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **displayNameUpdate** | [**DisplayNameUpdate**](DisplayNameUpdate.md)|  | 

### Return type

[**Profile**](Profile.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **updateUsername**
> Profile updateUsername(usernameUpdate)



### Example
```dart
import 'package:eigen_api/api.dart';

final api = EigenApi().getMeApi();
final UsernameUpdate usernameUpdate = ; // UsernameUpdate | 

try {
    final response = api.updateUsername(usernameUpdate);
    print(response);
} catch on DioException (e) {
    print('Exception when calling MeApi->updateUsername: $e\n');
}
```

### Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **usernameUpdate** | [**UsernameUpdate**](UsernameUpdate.md)|  | 

### Return type

[**Profile**](Profile.md)

### Authorization

[firebase](../README.md#firebase)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

