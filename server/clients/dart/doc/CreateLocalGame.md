# eigen_api.model.CreateLocalGame

## Load the model package
```dart
import 'package:eigen_api/api.dart';
```

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**gameId** | **String** |  | 
**schemaVersion** | **int** | The schemaVersion the device played at. Any version this deployment ships is accepted; a newer one answers 409 serverUpdateRequired. | 
**config** | **Object** |  | 
**minPlayers** | **int** |  | [optional] 
**maxPlayers** | **int** |  | [optional] 
**botIds** | **List&lt;String&gt;** |  | 
**seed** | **String** |  | 
**createdAt** | **int** | Epoch milliseconds, as the device recorded it. Stored as min(claimed, server now). | 

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


