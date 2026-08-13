import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:image_picker/image_picker.dart';
import 'package:eigen_api/eigen_api.dart';
import 'package:eigen_flutter/features/profile/presentation/image_cropper_assets.dart'
    if (dart.library.js_interop) 'package:eigen_flutter/features/profile/presentation/image_cropper_assets_web.dart';
import 'package:eigen_flutter/features/profile/providers/profile_providers.dart';
import 'package:eigen_flutter/features/rating/presentation/widgets/player_ratings.dart';
import 'package:eigen_flutter/shared/widgets/player_avatar.dart';

/// Profile screen: cinematic hero, per-pool rating cards, link to history.
///
/// Avatar tap → change photo directly.
/// ✎ icon → edit display name and username.
/// Ratings refresh automatically on each navigation (auto-dispose providers).
class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;
    final profileAsync = ref.watch(currentUserProfileProvider);

    return Scaffold(
      body: CustomScrollView(
        slivers: [
          SliverAppBar(
            pinned: true,
            expandedHeight: 280,
            actions: [
              if (profileAsync.hasValue)
                IconButton(
                  icon: const Icon(Icons.edit_outlined),
                  tooltip: 'Edit profile',
                  onPressed: () => _showEditSheet(context, profileAsync.value!),
                ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              titlePadding: const EdgeInsetsDirectional.only(
                start: 72,
                end: 72,
                bottom: 14,
              ),
              centerTitle: true,
              title: profileAsync.whenOrNull(
                data: (p) => Text(
                  p.displayName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.titleMedium?.copyWith(
                    color: colorScheme.onSurface,
                  ),
                ),
              ),
              background: profileAsync.when(
                data: (p) => _HeroBanner(
                  avatarUrl: p.avatarUrl,
                  username: p.username,
                  onAvatarTap: _pickAndUploadAvatar,
                ),
                loading: () => const _HeroBanner(
                  avatarUrl: null,
                  username: null,
                  onAvatarTap: null,
                ),
                error: (_, _) => const SizedBox.shrink(),
              ),
            ),
          ),

          const SliverToBoxAdapter(child: _RatingsSection()),

          const SliverToBoxAdapter(child: SizedBox(height: 32)),
        ],
      ),
    );
  }

  void _showEditSheet(BuildContext context, Profile profile) {
    if (MediaQuery.sizeOf(context).width >= 840) {
      showDialog<void>(
        context: context,
        builder: (_) => Dialog(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 560),
            child: _EditProfileSheet(profile: profile),
          ),
        ),
      );
      return;
    }

    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (_) => _EditProfileSheet(profile: profile),
    );
  }

  Future<void> _pickAndUploadAvatar() async {
    try {
      final ImageSource? source;
      if (kIsWeb) {
        source = ImageSource.gallery;
      } else {
        source = await _showImageSourceSheet();
        if (source == null) return;
      }

      final picker = ImagePicker();
      final file = await picker.pickImage(source: source, maxWidth: 1024);
      if (file == null || !mounted) return;

      final cropped = await _cropImage(file.path);
      if (cropped == null || !mounted) return;

      final bytes = await cropped.readAsBytes();
      await ref.read(currentUserProfileProvider.notifier).uploadAvatar(bytes);

      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(const SnackBar(content: Text('Profile photo updated!')));
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Failed to update photo: $e')));
      }
    }
  }

  Future<CroppedFile?> _cropImage(String sourcePath) async {
    await loadImageCropperAssets();
    if (!mounted) return null;

    return ImageCropper().cropImage(
      sourcePath: sourcePath,
      aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
      uiSettings: [
        AndroidUiSettings(
          toolbarTitle: 'Crop Photo',
          lockAspectRatio: true,
          initAspectRatio: CropAspectRatioPreset.square,
        ),
        IOSUiSettings(
          title: 'Crop Photo',
          aspectRatioLockEnabled: true,
          resetAspectRatioEnabled: false,
        ),
        WebUiSettings(context: context, presentStyle: WebPresentStyle.dialog),
      ],
    );
  }

  Future<ImageSource?> _showImageSourceSheet() {
    return showModalBottomSheet<ImageSource>(
      context: context,
      showDragHandle: true,
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt),
              title: const Text('Take a photo'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library),
              title: const Text('Choose from gallery'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Hero banner ───────────────────────────────────────────────────────────────

class _HeroBanner extends StatelessWidget {
  const _HeroBanner({
    required this.avatarUrl,
    required this.username,
    required this.onAvatarTap,
  });

  final String? avatarUrl;
  final String? username;
  final VoidCallback? onAvatarTap;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final textTheme = Theme.of(context).textTheme;

    return Stack(
      children: [
        Positioned.fill(
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [colorScheme.primaryContainer, colorScheme.surface],
              ),
            ),
          ),
        ),
        Positioned(
          top: kToolbarHeight,
          left: 0,
          right: 0,
          bottom: 40,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  _AvatarDisplay(
                    avatarUrl: avatarUrl,
                    radius: 60,
                    onTap: onAvatarTap,
                    semanticLabel: onAvatarTap == null
                        ? null
                        : 'Change profile photo',
                  ),
                  if (onAvatarTap != null)
                    Positioned(
                      bottom: 2,
                      right: 2,
                      child: IgnorePointer(
                        child: CircleAvatar(
                          radius: 12,
                          backgroundColor: colorScheme.primary,
                          child: Icon(
                            Icons.edit,
                            size: 12,
                            color: colorScheme.onPrimary,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
              if (username != null) ...[
                const SizedBox(height: 8),
                Text(
                  '@$username',
                  style: textTheme.bodyMedium?.copyWith(
                    color: colorScheme.onSurfaceVariant,
                  ),
                ),
              ],
            ],
          ),
        ),
      ],
    );
  }
}

// ── Avatar display ────────────────────────────────────────────────────────────

class _AvatarDisplay extends StatelessWidget {
  const _AvatarDisplay({
    required this.avatarUrl,
    required this.radius,
    this.onTap,
    this.semanticLabel,
  });

  final String? avatarUrl;
  final double radius;
  final VoidCallback? onTap;
  final String? semanticLabel;

  @override
  Widget build(BuildContext context) {
    // PlayerAvatar is the one URL boundary for the app: it resolves the
    // Worker's relative `/avatars/{uid}` path before CachedNetworkImage sees
    // it. The old profile-only widget skipped that step and worked only when a
    // bucket publicBaseUrl happened to make avatarUrl absolute.
    return PlayerAvatar(
      avatarUrl: avatarUrl,
      radius: radius,
      onTap: onTap,
      semanticLabel: semanticLabel,
    );
  }
}

// ── Ratings section ───────────────────────────────────────────────────────────

class _RatingsSection extends StatelessWidget {
  const _RatingsSection();

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final colorScheme = Theme.of(context).colorScheme;

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 28, 16, 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 4, bottom: 16),
            child: Text(
              'Ratings',
              style: textTheme.titleMedium?.copyWith(
                color: colorScheme.onSurfaceVariant,
              ),
            ),
          ),
          const PlayerRatings.me(),
        ],
      ),
    );
  }
}

// ── Edit profile sheet ────────────────────────────────────────────────────────

class _EditProfileSheet extends ConsumerStatefulWidget {
  const _EditProfileSheet({required this.profile});

  final Profile profile;

  @override
  ConsumerState<_EditProfileSheet> createState() => _EditProfileSheetState();
}

class _EditProfileSheetState extends ConsumerState<_EditProfileSheet> {
  final _formKey = GlobalKey<FormState>();
  late String _displayName;
  late String _username;
  bool _saving = false;

  static final _usernameRegex = RegExp(r'^[a-zA-Z0-9_.]{3,20}$');

  @override
  void initState() {
    super.initState();
    _displayName = widget.profile.displayName;
    _username = widget.profile.username;
  }

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;

    return SafeArea(
      top: false,
      child: SingleChildScrollView(
        padding: EdgeInsets.fromLTRB(
          24,
          24,
          24,
          24 + MediaQuery.viewInsetsOf(context).bottom,
        ),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.only(bottom: 28),
                child: Text('Edit Profile', style: textTheme.titleLarge),
              ),
              Column(
                children: [
                  TextFormField(
                    key: ValueKey('username_${widget.profile.id}'),
                    initialValue: widget.profile.username,
                    decoration: const InputDecoration(
                      labelText: 'Username',
                      hintText: 'Enter your username',
                      helperText: '3-20 characters: letters, numbers, _ or .',
                      prefixIcon: Icon(Icons.alternate_email),
                      border: OutlineInputBorder(),
                    ),
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'Please enter a username';
                      }
                      if (!_usernameRegex.hasMatch(v.trim())) {
                        return 'Use 3-20 characters: letters, numbers, _ or .';
                      }
                      return null;
                    },
                    onSaved: (v) => _username = v ?? '',
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    key: ValueKey('displayName_${widget.profile.id}'),
                    initialValue: widget.profile.displayName,
                    decoration: const InputDecoration(
                      labelText: 'Display Name',
                      hintText: 'Enter your display name',
                      prefixIcon: Icon(Icons.badge_outlined),
                      border: OutlineInputBorder(),
                    ),
                    textCapitalization: TextCapitalization.words,
                    validator: (v) {
                      if (v == null || v.trim().isEmpty) {
                        return 'Please enter a display name';
                      }
                      if (v.trim().length < 2) {
                        return 'Display name must be at least 2 characters';
                      }
                      return null;
                    },
                    onSaved: (v) => _displayName = v ?? '',
                  ),
                ],
              ),
              const SizedBox(height: 28),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _saving ? null : () => Navigator.pop(context),
                      child: const Text('Cancel'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      onPressed: _saving ? null : _save,
                      child: _saving
                          ? const SizedBox(
                              width: 16,
                              height: 16,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Text('Save'),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    _formKey.currentState!.save();

    setState(() => _saving = true);
    try {
      await ref
          .read(currentUserProfileProvider.notifier)
          .updateProfileFields(
            username: _username.trim(),
            displayName: _displayName.trim(),
          );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (!mounted) return;
      setState(() => _saving = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(_errorMessage(e))));
    }
  }

  String _errorMessage(Object error) {
    final s = error.toString();
    if (s.contains('Username already taken')) return 'Username already taken';
    if (s.contains('Username must be')) {
      return 'Username must be 3-20 characters: letters, numbers, _ or .';
    }
    return 'Failed to save: $s';
  }
}
