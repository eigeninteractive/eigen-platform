# eigen_api.model.Profile

## Load the model package
```dart
import 'package:eigen_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**id** | **String** |  | 
**username** | **String** |  | 
**displayName** | **String** |  | 
**avatarUrl** | **String** |  | 
**isAnonymous** | **bool** |  | 
**email** | **String** |  | 
**createdAt** | **int** | When this account was created. It changes only if the account was deleted and created again under the same id (a swept guest signing back in), so a client holding data for the account discards it when this differs. | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


